
import { publisher, buildChannel } from '../redis/index.js';

// ── Error classifier ──────────────────────────────────────────────────────
const ERROR_PATTERNS = [
  { type: 'syntax',      patterns: [/SyntaxError/i, /Unexpected token/i, /Cannot parse/i, /JSX/i] },
  { type: 'dependency',  patterns: [/Cannot find module/i, /Module not found/i, /npm ERR/i, /ENOENT.*node_modules/i] },
  { type: 'routing',     patterns: [/No routes matched/i, /useNavigate/i, /BrowserRouter/i, /Route/i] },
  { type: 'type',        patterns: [/TS\d{4}/i, /Type error/i, /is not assignable/i] },
  { type: 'import',      patterns: [/import/i, /export/i, /named export/i, /default export/i] },
  { type: 'build',       patterns: [/Build failed/i, /vite build/i, /rollup/i] },
];

export function classifyError(message = '') {
  for (const { type, patterns } of ERROR_PATTERNS) {
    if (patterns.some((re) => re.test(message))) return type;
  }
  return 'unknown';
}

// ── Token tracker ─────────────────────────────────────────────────────────
export class TokenTracker {
  constructor() {
    this.agents = {};
    this.total  = { input: 0, output: 0, cost_usd: 0 };
  }

  // GPT-4o pricing (per 1K tokens, as of 2024)
  static PRICE = { input: 0.005, output: 0.015 };

  record(agentName, usage = {}) {
    const input  = usage.input_tokens  ?? usage.prompt_tokens     ?? 0;
    const output = usage.output_tokens ?? usage.completion_tokens ?? 0;
    const cost   = (input / 1000) * TokenTracker.PRICE.input
                 + (output / 1000) * TokenTracker.PRICE.output;

    if (!this.agents[agentName]) {
      this.agents[agentName] = { input: 0, output: 0, cost_usd: 0, calls: 0 };
    }
    this.agents[agentName].input    += input;
    this.agents[agentName].output   += output;
    this.agents[agentName].cost_usd += cost;
    this.agents[agentName].calls    += 1;

    this.total.input    += input;
    this.total.output   += output;
    this.total.cost_usd += cost;
  }

  summary() {
    return {
      agents: this.agents,
      total:  {
        ...this.total,
        cost_usd: +this.total.cost_usd.toFixed(6),
      },
    };
  }
}

// ── Tool-call audit trail ─────────────────────────────────────────────────
export class AuditTrail {
  constructor() {
    this.calls = [];
  }

  record({ agent, tool, input, output, durationMs, error = null }) {
    this.calls.push({
      ts:         new Date().toISOString(),
      agent,
      tool,
      input:      typeof input  === 'object' ? JSON.stringify(input)  : String(input  ?? ''),
      output:     typeof output === 'object' ? JSON.stringify(output) : String(output ?? '').slice(0, 300),
      durationMs,
      error:      error ? String(error) : null,
    });
  }

  forAgent(agentName) {
    return this.calls.filter((c) => c.agent === agentName);
  }

  summary() {
    const byTool = {};
    for (const c of this.calls) {
      byTool[c.tool] = (byTool[c.tool] ?? 0) + 1;
    }
    return { totalCalls: this.calls.length, byTool, calls: this.calls };
  }
}

// ── Pipeline logger ───────────────────────────────────────────────────────
export class PipelineLogger {
  constructor(chatId, jobId) {
    this.chatId   = chatId;
    this.jobId    = jobId;
    this.tokens   = new TokenTracker();
    this.audit    = new AuditTrail();
    this.stages   = [];
    this._timers  = {};
  }

  // Start timing a named stage
  startStage(name) {
    this._timers[name] = Date.now();
    this._log('info', `[${name}] started`);
  }

  // End a stage and record duration
  endStage(name, meta = {}) {
    const durationMs = Date.now() - (this._timers[name] ?? Date.now());
    const entry = { stage: name, durationMs, ...meta };
    this.stages.push(entry);
    this._log('info', `[${name}] completed in ${durationMs}ms`, meta);
    return entry;
  }

  // Record token usage after each agent run
  recordTokens(agentName, result) {
    // @openai/agents SDK exposes usage on the RunResult object
    const usage = result?.usage ?? result?.rawResponse?.usage ?? null;
    if (usage) this.tokens.record(agentName, usage);
  }

  // Record a tool call (wrap around tool execution)
  recordTool(agent, tool, input, output, durationMs, error = null) {
    this.audit.record({ agent, tool, input, output, durationMs, error });
  }

  // Log an error with classification
  error(stage, err) {
    const rawMessage = err?.message ?? String(err);
    // Some LLM providers attach the full attempted tool-call JSON to an
    // error. Do not send source code into terminal logs or chat events.
    const msg = rawMessage.includes('failed_generation') || rawMessage.length > 1_000
      ? 'Model produced an invalid or truncated tool call.'
      : rawMessage;
    const type = classifyError(msg);
    this._log('error', `[${stage}] ${type.toUpperCase()} error: ${msg}`, { errorType: type });
    return { type, message: msg };
  }

  // Publish full telemetry to Redis (picked up by WebSocket → browser)
  async publishTelemetry() {
    const payload = JSON.stringify({
      type:    'telemetry',
      chatId:  this.chatId,
      jobId:   this.jobId,
      stages:  this.stages,
      tokens:  this.tokens.summary(),
      audit:   this.audit.summary(),
      ts:      Date.now(),
    });
    await publisher.publish(buildChannel(this.chatId), payload).catch(() => {});
  }

  // Internal structured log (stdout)
  _log(level, message, meta = {}) {
    const line = JSON.stringify({
      level,
      ts:     new Date().toISOString(),
      chatId: this.chatId,
      jobId:  this.jobId,
      message,
      ...meta,
    });
    if (level === 'error') {
      console.error(line);
    } else {
      console.log(line);
    }
  }
}
