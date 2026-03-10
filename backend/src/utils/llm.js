
import { ChatAnthropic } from '@langchain/anthropic';

const BUILDER_MODEL = process.env.CLAUDE_BUILDER_MODEL ?? 'claude-haiku-4-5-20251001';
const PLANNER_MODEL = process.env.CLAUDE_PLANNER_MODEL ?? 'claude-haiku-4-5-20251001';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export function makeModel(modelType = 'builder', temperature = 0.2, maxTokens = 2048) {
  return new ChatAnthropic({
    model:      modelType === 'builder' ? BUILDER_MODEL : PLANNER_MODEL,
    apiKey:     ANTHROPIC_API_KEY,
    temperature,
    maxTokens,
  });
}

export { BUILDER_MODEL, PLANNER_MODEL };
