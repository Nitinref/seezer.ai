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
  modelOptions = {}
}){
  // A plan with files, steps, and descriptions is often cut off at 1024
  // tokens, which then falls back to a generic template. Leave room for the
  // planner's real JSON response.
  const model = makeModel('planner', 0, 2048, modelOptions);

  const result = await Promise.race([
    model.invoke([
      new SystemMessage(PLANNER_SYSTEM),
      new HumanMessage(prompt),
    ]),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`PlannerAgent timeout after ${Math.round(timeoutMs / 1000)}s`)), timeoutMs)
    ),
  ]);

  const content = result.content;
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
