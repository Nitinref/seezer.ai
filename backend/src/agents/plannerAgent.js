import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { makeModel, PLANNER_TIMEOUT_MS } from '../utils/llm.js';
import { PLANNER_SYSTEM } from '../prompts/prompts.js';

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
  // A plan with files, steps, and descriptions is often cut off at 1024
  // tokens, which then falls back to a generic template. Leave room for the
  // planner's real JSON response.
  const model = makeModel('planner', 0, 2048, modelOptions);
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
      new SystemMessage(PLANNER_SYSTEM),
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
