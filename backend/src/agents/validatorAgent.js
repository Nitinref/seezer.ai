import { runReActAgent } from './runAgent.js';
import { VALIDATOR_SYSTEM } from '../prompts/prompts.js';
import { VALIDATOR_TIMEOUT_MS } from '../utils/llm.js';

/**
 * runValidatorAgent
 * @param {Array}  tools      — validator tools: read_file, create_file, list_directory, check_missing_packages, save_context
 * @param {number} timeoutMs
 */
export async function runValidatorAgent({ tools, timeoutMs = VALIDATOR_TIMEOUT_MS,emit,chatId}) {
    return Promise.race([
        runReActAgent({
            systemPrompt: VALIDATOR_SYSTEM,
            userPrompt: 'First call get_context() with key "builder" to understand what was built. Then validate every source file in /app/src and fix all issues.',
            tools,
            emit,
            chatId,
            temperature: 0.1,
            maxTokens: 2048,  // 4096 → 2048
            maxSteps: 8,
            modelType: 'planner',
            agentName:'validator' // haiku
        }),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`ValidatorAgent timeout after ${timeoutMs / 1000}s`)), timeoutMs)
        ),
    ]);
}
