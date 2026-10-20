

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
 */export async function runBuilderAgent({ plan, userMessage, tools, timeoutMs = BUILDER_TIMEOUT_MS,emit,chatId,modelOptions = {}, repair = false }) {
  const repairInstruction = repair
    ? '\n\nREPAIR MODE: The previous attempt did not write application code. You MUST call write_multiple_files, create_file, or edit_files now. Write the requested application across the files listed in the plan; keep /app/src/pages/Home.jsx only as the route entry when appropriate. Do not answer with an explanation until code is written.'
    : '';
  const systemPrompt = repair
    ? `You are a direct file-writing agent. Do not explain or stop before writing code. Use the validated plan and immediately call write_multiple_files, create_file, or edit_files to write the complete requested app across the planned files. Keep src/pages/Home.jsx as the root entry only when appropriate. User request: ${userMessage}`
    : BUILDER_SYSTEM;
  const userPrompt = `First call get_context() with key "builder" to load any existing project state.\n\nThen execute this build plan:\n${JSON.stringify(plan, null, 2)}\n\nOriginal request: ${userMessage}${repairInstruction}`;

  return Promise.race([
    runReActAgent({
      systemPrompt,
      userPrompt,
      tools,
      emit,
      chatId,
      temperature:  0.2,
      maxTokens:    repair ? 900 : 2048,
      maxSteps:     repair ? 3 : 14,
      modelType:    'builder',
      agentName: "builder",
      modelOptions
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`BuilderAgent timeout after ${timeoutMs / 1000}s`)), timeoutMs)
    ),
  ]);
}
