

import { runReActAgent } from './runAgent.js';
import { CHECKER_SYSTEM } from '../prompts/prompts.js';
import { CHECKER_TIMEOUT_MS } from '../utils/llm.js';

/**
 * runCheckerAgent
 * @param {Array}  tools     — checker tools: test_build, execute_command, read_file, create_file, save_context
 * @param {number} timeoutMs
 */
export async function runCheckerAgent({ tools, timeoutMs = CHECKER_TIMEOUT_MS,emit,chatId}) {
    return Promise.race([
        runReActAgent({
            systemPrompt: CHECKER_SYSTEM,
            userPrompt: 'Run the build, fix any compilation errors, then run ESLint.',
            tools,
            temperature: 0.1,
            maxTokens: 2048,  // 4096 → 2048
            maxSteps: 8,
            emit,
            chatId,
            modelType: 'planner',
            agentName:'checker' // haiku
        }),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`CheckerAgent timeout after ${timeoutMs / 1000}s`)), timeoutMs)
        ),
    ]);
}
