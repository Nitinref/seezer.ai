import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { makeModel, PLANNER_TIMEOUT_MS } from '../utils/llm.js';
import { PLANNER_SYSTEM } from '../prompts/prompts.js';

// Groq's Qwen route has a tight output-per-minute ceiling. The full visual
// planning brief can make it reach that limit midway through a JSON array,
// leaving the Builder with an invalid/truncated plan. Keep the same schema,
// but bound every variable-length field so the closing brace is always sent.
const COMPACT_GROQ_PLANNER_SYSTEM = `You are a React architect. Return ONLY one valid raw JSON object; no markdown.
Use exactly this shape:
{"summary":"","approach":"","homeComponent":"src/pages/Home.jsx","files":[{"path":"src/pages/Home.jsx","action":"update","description":""}],"newPages":[],"packages":[],"steps":[],"ui":{"visualDirection":"","palette":[],"typography":"","sections":[],"interactions":[],"responsiveNotes":""}}
Rules: files max 6, steps max 4, sections max 5, interactions max 4, palette max 4. For any multi-section UI, include Home.jsx plus at least two focused files under src/components/ or src/data/. Keep every string under 90 characters. Use only installed packages. Start with { and end with }.`;

function extractJSON(text) {
  if (typeof text !== 'string') return text;
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    let jsonStr = text.slice(start, end + 1);
    jsonStr = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
    return jsonStr;
  }
  return text;
}


export async function runPlannerAgent({
  prompt,
  timeoutMs = PLANNER_TIMEOUT_MS,
  emit,
  chatId,
  modelOptions = {},
  onUsage = async () => {}
}){
  // Groq's on-demand free tier enforces a 1K output-token-per-minute cap.
  // Keep its plan compact enough to succeed; paid providers retain the
  // larger planning budget for detailed JSON.
  // A small amount of variation avoids repeatedly producing the same generic
  // component plan while remaining structured enough for JSON output.
  const provider = modelOptions.provider ?? process.env.PLANNER_PROVIDER;
  const useCompactGroqPlan = provider === 'groq';
  const maxTokens = useCompactGroqPlan
    ? 650
    : 2048;
  const model = makeModel('planner', 0.25, maxTokens, modelOptions);
  const controller = new AbortController();
  let timeout;
  const deadline = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new Error(`PlannerAgent timeout after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
  });
  let result;
  try {
    const invocation = model.invoke([
      new SystemMessage(useCompactGroqPlan ? COMPACT_GROQ_PLANNER_SYSTEM : PLANNER_SYSTEM),
      new HumanMessage(prompt),
    ], { signal: controller.signal });
    // Some provider adapters ignore AbortSignal while waiting for a response.
    // Race the request so a stalled planner cannot delay the builder forever.
    result = await Promise.race([
      invocation,
      deadline,
    ]);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`PlannerAgent timeout after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const content = result.content;
  const usage = result.usage_metadata
    ?? result.response_metadata?.usage_metadata
    ?? result.response_metadata?.usage
    ?? result.response_metadata?.usageMetadata;
  if (usage) await onUsage(usage);
  let text;
  if (typeof content === 'string') text = content;
  else if (Array.isArray(content)) text = content.map((p) => (
    typeof p === 'string' ? p : p?.text ?? p?.content ?? ''
  )).join('');
  else text = JSON.stringify(content ?? '');

  if (!text.trim()) {
    const metadata = result?.additional_kwargs ?? {};
    const responseMessage = result?.response_metadata?.choices?.[0]?.message ?? {};
    const alternate = metadata.content
      ?? metadata.reasoning_content
      ?? metadata.reasoning
      ?? responseMessage.content
      ?? responseMessage.reasoning_content
      ?? responseMessage.reasoning;
    if (alternate) text = String(alternate);
  }
  console.log(`[PlannerAgent] response fields content=${typeof content} additional=${Object.keys(result?.additional_kwargs ?? {}).join(',') || 'none'}`);
  console.log(`[PlannerAgent] response chars=${text.trim().length}`);

  return extractJSON(text);
}
