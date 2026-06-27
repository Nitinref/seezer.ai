import "dotenv/config";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";

/* ---------------- ENV ---------------- */

// Claude Models
const CLAUDE_BUILDER_MODEL =
  process.env.CLAUDE_BUILDER_MODEL || "claude-haiku-4-5-20251001";

const CLAUDE_PLANNER_MODEL =
  process.env.CLAUDE_PLANNER_MODEL || "claude-haiku-4-5-20251001";

// OpenRouter Models
const OPENROUTER_VALIDATOR_MODEL =
  process.env.OPENROUTER_VALIDATOR_MODEL ||
  "deepseek/deepseek-chat-v3-0324:free";

const OPENROUTER_CHECKER_MODEL =
  process.env.OPENROUTER_CHECKER_MODEL ||
  "qwen/qwen-2.5-coder:free";

// Keys
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// OpenRouter Config
const OPENROUTER_BASE_URL =
  process.env.OPENROUTER_BASE_URL ||
  "https://openrouter.ai/api/v1";

const OPENROUTER_APP_URL =
  process.env.OPENROUTER_APP_URL || "http://localhost:3000";

const OPENROUTER_APP_NAME =
  process.env.OPENROUTER_APP_NAME || "Seezer.ai";

/* ---------------- TIMEOUTS ---------------- */

const REQUEST_TIMEOUT_MS = Number.parseInt(
  process.env.LLM_REQUEST_TIMEOUT_MS || "90000",
  10
);

const PLANNER_TIMEOUT_MS = Number.parseInt(
  process.env.PLANNER_TIMEOUT_MS || "30000",
  10
);

const AGENT_TIMEOUT_MS = Number.parseInt(
  process.env.AGENT_TIMEOUT_MS || "90000",
  10
);

const VALIDATOR_TIMEOUT_MS = Number.parseInt(
  process.env.VALIDATOR_TIMEOUT_MS || "90000",
  10
);

const CHECKER_TIMEOUT_MS = Number.parseInt(
  process.env.CHECKER_TIMEOUT_MS || "90000",
  10
);

const BUILDER_TIMEOUT_MS = Number.parseInt(
  process.env.BUILDER_TIMEOUT_MS || "300000",
  10
);

/* ---------------- FACTORIES ---------------- */

function createAnthropicModel(
  model,
  temperature = 0.2,
  maxTokens = 2048,
  timeout = REQUEST_TIMEOUT_MS
) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY missing");
  }

  return new ChatAnthropic({
    model,
    apiKey: ANTHROPIC_API_KEY,
    temperature,
    maxTokens,
    timeout,
  });
}

function createOpenRouterModel(
  model,
  temperature = 0.2,
  maxTokens = 2048,
  timeout = REQUEST_TIMEOUT_MS
) {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY missing");
  }

  return new ChatOpenAI({
    model,
    apiKey: OPENROUTER_API_KEY,
    openAIApiKey: OPENROUTER_API_KEY,
    temperature,
    maxTokens,
    timeout,

    configuration: {
      baseURL: OPENROUTER_BASE_URL,
      defaultHeaders: {
        "HTTP-Referer": OPENROUTER_APP_URL,
        "X-Title": OPENROUTER_APP_NAME,
      },
    },
  });
}

/* ---------------- MAIN FACTORY ---------------- */

export function makeModel(
  agentType,
  temperature = 0.2,
  maxTokens = 2048
) {
  switch (agentType) {
    // Claude Agents
    case "planner":
      return createAnthropicModel(
        CLAUDE_PLANNER_MODEL,
        temperature,
        maxTokens,
        PLANNER_TIMEOUT_MS
      );

    case "builder":
      return createAnthropicModel(
        CLAUDE_BUILDER_MODEL,
        temperature,
        maxTokens,
        BUILDER_TIMEOUT_MS,
      );

    // OpenRouter Agents
    case "validator":
      return createOpenRouterModel(
        OPENROUTER_VALIDATOR_MODEL,
        temperature,
        maxTokens,
        VALIDATOR_TIMEOUT_MS
      );

    case "checker":
      return createOpenRouterModel(
        OPENROUTER_CHECKER_MODEL,
        temperature,
        maxTokens,
        CHECKER_TIMEOUT_MS
      );

    default:
      throw new Error(`Unknown agent type: ${agentType}`);
  }
}

/* ---------------- EXPORTS ---------------- */

export {
  CLAUDE_BUILDER_MODEL,
  CLAUDE_PLANNER_MODEL,
  OPENROUTER_VALIDATOR_MODEL,
  OPENROUTER_CHECKER_MODEL,
  REQUEST_TIMEOUT_MS,
  PLANNER_TIMEOUT_MS,
  AGENT_TIMEOUT_MS,
  VALIDATOR_TIMEOUT_MS,
  CHECKER_TIMEOUT_MS,
  BUILDER_TIMEOUT_MS,
};