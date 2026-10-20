import "dotenv/config";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGroq } from "@langchain/groq";

/* ---------------- ENV ---------------- */

// Claude Models
const CLAUDE_BUILDER_MODEL =
  process.env.CLAUDE_BUILDER_MODEL || "claude-haiku-4-5-20251001";

const CLAUDE_PLANNER_MODEL =
  process.env.CLAUDE_PLANNER_MODEL || "claude-haiku-4-5-20251001";

// OpenRouter Models
const OPENROUTER_VALIDATOR_MODEL =
  process.env.OPENROUTER_VALIDATOR_MODEL ||
  "openrouter/free";

const OPENROUTER_CHECKER_MODEL =
  process.env.OPENROUTER_CHECKER_MODEL ||
  "openrouter/free";

const DEFAULT_PROVIDER = process.env.LLM_PROVIDER || "openrouter";
const OPENROUTER_DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL || "openrouter/free";

const GROQ_PLANNER_MODEL = process.env.GROQ_PLANNER_MODEL || "qwen/qwen3.8-27b";
const GROQ_BUILDER_MODEL = process.env.GROQ_BUILDER_MODEL || "qwen/qwen3.8-27b";
const GROQ_VALIDATOR_MODEL = process.env.GROQ_VALIDATOR_MODEL || "qwen/qwen3.8-27b";
const GROQ_CHECKER_MODEL = process.env.GROQ_CHECKER_MODEL || "qwen/qwen3.8-27b";
const AGENT_PROVIDERS = {
  planner: process.env.PLANNER_PROVIDER || "openrouter",
  builder: process.env.BUILDER_PROVIDER || "openrouter",
  validator: process.env.VALIDATOR_PROVIDER || "groq",
  checker: process.env.CHECKER_PROVIDER || "groq",
};

// Keys
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

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
  process.env.LLM_REQUEST_TIMEOUT_MS || "60000",
  10
);

const PLANNER_TIMEOUT_MS = Number.parseInt(
  process.env.PLANNER_TIMEOUT_MS || "60000",
  10
);

const AGENT_TIMEOUT_MS = Number.parseInt(
  process.env.AGENT_TIMEOUT_MS || "90000",
  10
);

const VALIDATOR_TIMEOUT_MS = Number.parseInt(
  process.env.VALIDATOR_TIMEOUT_MS || "60000",
  10
);

const CHECKER_TIMEOUT_MS = Number.parseInt(
  process.env.CHECKER_TIMEOUT_MS || "180000",
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

function createGroqModel(model, temperature = 0.2, maxTokens = 2048, timeout = REQUEST_TIMEOUT_MS) {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY missing");
  return new ChatGroq({ model, apiKey: GROQ_API_KEY, temperature, maxTokens, timeout });
}

/* ---------------- MAIN FACTORY ---------------- */

export function makeModel(
  agentType,
  temperature = 0.2,
  maxTokens = 2048,
  options = {}
) {
  const provider = AGENT_PROVIDERS[agentType] || DEFAULT_PROVIDER;
  const selectedProvider = options.provider && ["planner", "builder"].includes(agentType)
    ? options.provider
    : provider;
  const timeout = agentType === "planner" ? PLANNER_TIMEOUT_MS : agentType === "builder" ? BUILDER_TIMEOUT_MS : agentType === "validator" ? VALIDATOR_TIMEOUT_MS : CHECKER_TIMEOUT_MS;

  if (selectedProvider === "groq") {
    const groqModel = agentType === "planner"
      ? GROQ_PLANNER_MODEL
      : agentType === "builder"
        ? GROQ_BUILDER_MODEL
        : agentType === "checker"
          ? GROQ_CHECKER_MODEL
          : GROQ_VALIDATOR_MODEL;
    return createGroqModel(groqModel, temperature, maxTokens, timeout);
  }

  if (selectedProvider === "openrouter") {
    return createOpenRouterModel(
      options.model || (agentType === "checker" ? OPENROUTER_CHECKER_MODEL : OPENROUTER_DEFAULT_MODEL),
      temperature,
      maxTokens,
      timeout
    );
  }

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
  DEFAULT_PROVIDER,
  OPENROUTER_DEFAULT_MODEL,
  GROQ_VALIDATOR_MODEL,
  GROQ_CHECKER_MODEL,
  GROQ_PLANNER_MODEL,
  AGENT_PROVIDERS,
  REQUEST_TIMEOUT_MS,
  PLANNER_TIMEOUT_MS,
  AGENT_TIMEOUT_MS,
  VALIDATOR_TIMEOUT_MS,
  CHECKER_TIMEOUT_MS,
  BUILDER_TIMEOUT_MS,
};
