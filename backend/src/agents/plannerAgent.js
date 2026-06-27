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
  chatId
}){
  const model = makeModel('planner', 0, 1024);

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
  else if (Array.isArray(content)) text = content.map((p) => (typeof p === 'string' ? p : p?.text ?? '')).join('');
  else text = JSON.stringify(content ?? '');

  return extractJSON(text);
}
