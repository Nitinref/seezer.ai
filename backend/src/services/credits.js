import prisma from '../db/index.js';

const RATE_CARD = {
  gemini: { input: 0.5, output: 3 },
  groq: { input: 0.6, output: 0.8 },
  openrouter: { input: 1, output: 3 },
  anthropic: { input: 1, output: 5 },
  bedrock: { input: 1, output: 4 },
};
// Credits are an application price, rather than a direct pass-through of a
// provider invoice. Keep charging proportional to real token use, while the
// markup makes substantial generation runs meaningfully consume credits.
const CREDIT_RATE_MULTIPLIER = Number(process.env.CREDIT_RATE_MULTIPLIER || 8);
const MINIMUM_BUILD_CREDIT_USD = Number(process.env.MINIMUM_BUILD_CREDIT_USD || 0.05);

function tokensFrom(usage = {}) {
  const input = Number(usage.input_tokens ?? usage.inputTokens ?? usage.prompt_tokens ?? usage.promptTokens ?? usage.promptTokenCount ?? usage.prompt_token_count ?? 0);
  const output = Number(usage.output_tokens ?? usage.outputTokens ?? usage.completion_tokens ?? usage.completionTokens ?? usage.candidatesTokenCount ?? usage.candidates_token_count ?? 0);
  return { input: Number.isFinite(input) ? input : 0, output: Number.isFinite(output) ? output : 0 };
}

export function calculateUsageCost(usage, provider = 'openrouter') {
  const { input, output } = tokensFrom(usage);
  const rates = RATE_CARD[provider] ?? RATE_CARD.openrouter;
  const multiplier = Number.isFinite(CREDIT_RATE_MULTIPLIER) && CREDIT_RATE_MULTIPLIER > 0
    ? CREDIT_RATE_MULTIPLIER
    : 1;
  return Number(((((input * rates.input) + (output * rates.output)) / 1_000_000) * multiplier).toFixed(6));
}

export async function getCreditBalance(userId) {
  return prisma.user.findUnique({ where: { id: userId }, select: { creditBalanceUsd: true } });
}

export async function chargeUsage({ userId, jobId, agent, provider, model, usage }) {
  const { input, output } = tokensFrom(usage);
  const requestedCost = calculateUsageCost(usage, provider);
  if (requestedCost <= 0) return { chargedUsd: 0, balanceUsd: null, exhausted: false };

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { creditBalanceUsd: true } });
    if (!user) throw new Error('User not found while charging credits');
    const balance = Number(user.creditBalanceUsd);
    const chargedUsd = Math.min(balance, requestedCost);
    const nextBalance = Math.max(0, Number((balance - chargedUsd).toFixed(6)));

    await tx.user.update({ where: { id: userId }, data: { creditBalanceUsd: nextBalance } });
    await tx.creditTransaction.create({
      data: { userId, jobId: String(jobId), agent, provider, model: model || null, inputTokens: input, outputTokens: output, amountUsd: -chargedUsd },
    });
    return { chargedUsd, balanceUsd: nextBalance, exhausted: nextBalance <= 0 };
  });
}

// Model responses can arrive several times during one build. Write their
// usage in one short transaction once the run finishes instead of opening a
// database transaction from every LangGraph stream event.
export async function chargeUsageBatch({ userId, jobId, usages = [] }) {
  const rows = usages.map(({ agent, provider, model, usage }) => {
    const { input, output } = tokensFrom(usage);
    return {
      agent,
      provider,
      model: model || null,
      inputTokens: input,
      outputTokens: output,
      requestedCost: calculateUsageCost(usage, provider),
    };
  }).filter((row) => row.requestedCost > 0);

  if (!rows.length) return { chargedUsd: 0, balanceUsd: null, exhausted: false, entries: 0 };

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { creditBalanceUsd: true } });
    if (!user) throw new Error('User not found while charging credits');

    let remaining = Number(user.creditBalanceUsd);
    const ledgerRows = rows.map((row) => {
      const charged = Math.min(remaining, row.requestedCost);
      remaining = Math.max(0, Number((remaining - charged).toFixed(6)));
      return {
        userId,
        jobId: String(jobId),
        agent: row.agent,
        provider: row.provider,
        model: row.model,
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        amountUsd: -charged,
      };
    });
    const chargedUsd = Number((-ledgerRows.reduce((sum, row) => sum + row.amountUsd, 0)).toFixed(6));

    await tx.user.update({ where: { id: userId }, data: { creditBalanceUsd: remaining } });
    await tx.creditTransaction.createMany({ data: ledgerRows });
    return { chargedUsd, balanceUsd: remaining, exhausted: remaining <= 0, entries: ledgerRows.length };
  });
}

// A build can be very small (for example, a one-file todo list). Charge the
// token cost first, then bring a completed build up to this configurable
// minimum once—never once per planner/builder/checker agent.
export async function enforceMinimumBuildCharge({ userId, jobId, provider = 'openrouter' }) {
  return prisma.$transaction(async (tx) => {
    const [user, usage] = await Promise.all([
      tx.user.findUnique({ where: { id: userId }, select: { creditBalanceUsd: true } }),
      tx.creditTransaction.aggregate({ where: { jobId: String(jobId) }, _sum: { amountUsd: true } }),
    ]);
    if (!user) throw new Error('User not found while applying build minimum');

    const alreadyCharged = Math.abs(Number(usage._sum.amountUsd ?? 0));
    const requestedTopUp = Math.max(0, Number((MINIMUM_BUILD_CREDIT_USD - alreadyCharged).toFixed(6)));
    const balance = Number(user.creditBalanceUsd);
    const chargedUsd = Math.min(balance, requestedTopUp);
    const nextBalance = Math.max(0, Number((balance - chargedUsd).toFixed(6)));

    if (chargedUsd > 0) {
      await tx.user.update({ where: { id: userId }, data: { creditBalanceUsd: nextBalance } });
      await tx.creditTransaction.create({
        data: { userId, jobId: String(jobId), agent: 'build_minimum', provider, inputTokens: 0, outputTokens: 0, amountUsd: -chargedUsd },
      });
    }
    return { chargedUsd, balanceUsd: nextBalance, applied: chargedUsd > 0 };
  });
}
