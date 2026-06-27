

import { runReActAgent } from './runAgent.js';
import { BUILDER_SYSTEM } from '../prompts/prompts.js';
import { BUILDER_TIMEOUT_MS } from '../utils/llm.js';

/**
 * runBuilderAgent
 * @param {object}  opts
 * @param {object}  opts.plan         — validated plan object from PlannerAgent
 * @param {string}  opts.userMessage  — original user request
 * @param {Array}   opts.tools        — all sandbox LangChain tools
 * @param {number}  opts.timeoutMs
 */export async function runBuilderAgent({ plan, userMessage, tools, timeoutMs = BUILDER_TIMEOUT_MS,emit,chatId }) {
  const userPrompt = `First call get_context() with key "builder" to load any existing project state.\n\nThen execute this build plan:\n${JSON.stringify(plan, null, 2)}\n\nOriginal request: ${userMessage}`;

  return Promise.race([
    runReActAgent({
      systemPrompt: BUILDER_SYSTEM,
      userPrompt,
      tools,
      emit,
      chatId,
      temperature:  0.2,
      maxTokens:    4096,  // 8192 → 4096
      maxSteps:     15,    // 25 → 15
      modelType:    'builder',
      agentName: "builder"
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`BuilderAgent timeout after ${timeoutMs / 1000}s`)), timeoutMs)
    ),
  ]);
}
