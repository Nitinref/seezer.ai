import "dotenv/config";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGroq } from "@langchain/groq";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatBedrockConverse } from "@langchain/aws";

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
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const NVIDIA_DEEPSEEK_MODEL = process.env.NVIDIA_DEEPSEEK_MODEL || "deepseek-ai/deepseek-v4.1-flash";
// Amazon Bedrock Mantle exposes an OpenAI-compatible Chat Completions API.
// Keep the model IDs configurable: access can vary by AWS account and region.
const BEDROCK_PLANNER_MODEL = process.env.BEDROCK_PLANNER_MODEL || "moonshotai.kimi-k2.5";
const BEDROCK_BUILDER_MODEL = process.env.BEDROCK_BUILDER_MODEL || "qwen.qwen3-coder-next";

const GROQ_PLANNER_MODEL = process.env.GROQ_PLANNER_MODEL || "qwen/qwen3.8-27b";
const GROQ_BUILDER_MODEL = process.env.GROQ_BUILDER_MODEL || "qwen/qwen3.8-27b";
const GROQ_VALIDATOR_MODEL = process.env.GROQ_VALIDATOR_MODEL || "qwen/qwen3.8-27b";
const GROQ_CHECKER_MODEL = process.env.GROQ_CHECKER_MODEL || "qwen/qwen3.8-27b";
const AGENT_PROVIDERS = {
  planner: process.env.PLANNER_PROVIDER || "groq",
  builder: process.env.BUILDER_PROVIDER || "openrouter",
  validator: process.env.VALIDATOR_PROVIDER || "groq",
  checker: process.env.CHECKER_PROVIDER || "groq",
};

// Keys
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const BEDROCK_API_KEY = process.env.BEDROCK_API_KEY || process.env.AWS_BEARER_TOKEN_BEDROCK;

// OpenRouter Config
const OPENROUTER_BASE_URL =
  process.env.OPENROUTER_BASE_URL ||
  "https://openrouter.ai/api/v1";

const OPENROUTER_APP_URL =
  process.env.OPENROUTER_APP_URL || "http://localhost:3000";

const OPENROUTER_APP_NAME =
  process.env.OPENROUTER_APP_NAME || "Seezer.ai";

const NVIDIA_NIM_BASE_URL = process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1";
const BEDROCK_REGION = process.env.BEDROCK_REGION || "us-east-1";
// Mantle's OpenAI-compatible models (such as Grok 4.3) require this exact
// API prefix. The native Bedrock Converse client below does not use it.
const BEDROCK_BASE_URL = process.env.BEDROCK_BASE_URL || `https://bedrock-mantle.${BEDROCK_REGION}.api.aws/openai/v1`;

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
  // A stalled tool-calling turn used to keep the UI waiting for five minutes.
  // Fail fast enough to surface a useful error/retry instead.
  process.env.BUILDER_TIMEOUT_MS || "75000",
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
    // Free OpenRouter providers can silently retry/reroute for minutes.
    // Let the pipeline make a visible, bounded retry instead.
    maxRetries: 0,

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

function createGeminiModel(model, temperature = 0.2, maxTokens = 2048) {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY (or GOOGLE_API_KEY) missing");
  return new ChatGoogleGenerativeAI({
    model,
    apiKey: GEMINI_API_KEY,
    temperature,
    maxOutputTokens: maxTokens,
    // The Gemini free tier has a small daily request allowance. Retrying a
    // 429 internally spends more requests without helping the active build.
    maxRetries: 0,
  });
}

function createNvidiaModel(model, temperature = 0.2, maxTokens = 2048, timeout = REQUEST_TIMEOUT_MS) {
  if (!NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY missing");
  return new ChatOpenAI({
    model,
    apiKey: NVIDIA_API_KEY,
    temperature,
    maxTokens,
    timeout,
    maxRetries: 0,
    configuration: { baseURL: NVIDIA_NIM_BASE_URL },
  });
}

function createBedrockModel(model, temperature = 0.2, maxTokens = 2048, timeout = REQUEST_TIMEOUT_MS) {
  if (!BEDROCK_API_KEY) {
    throw new Error("BEDROCK_API_KEY (or AWS_BEARER_TOKEN_BEDROCK) missing");
  }
  // Grok 4.3 is hosted on Bedrock Mantle but supports the OpenAI-compatible
  // Chat Completions API. DeepSeek V3.2 must use native Converse here; the
  // configured /openai/v1 Mantle route rejects it even though Workbench can
  // invoke the model through Bedrock Runtime.
  if (model === 'xai.grok-4.3') {
    return new ChatOpenAI({
      model,
      apiKey: BEDROCK_API_KEY,
      openAIApiKey: BEDROCK_API_KEY,
      temperature,
      maxTokens,
      timeout,
      maxRetries: 0,
      configuration: { baseURL: BEDROCK_BASE_URL },
    });
  }
  // Native Bedrock Converse avoids the OpenAI-compatible Mantle translation
  // layer, which was producing slow or malformed tool-call payloads for Qwen.
  // The AWS SDK understands Bedrock bearer API keys directly.
  return new ChatBedrockConverse({
    model,
    region: BEDROCK_REGION,
    bedrockBearerToken: BEDROCK_API_KEY,
    temperature,
    maxTokens,
    streaming: false,
  });
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
  const timeout = agentType === "planner"
    ? PLANNER_TIMEOUT_MS
    : agentType === "builder"
      // NVIDIA's free DeepSeek endpoint can take longer than a minute to
      // begin a sizeable tool-call response. Keep its request alive for the
      // builder's full bounded agent window.
      ? ["nvidia", "bedrock"].includes(selectedProvider)
        ? Math.min(BUILDER_TIMEOUT_MS, 180_000)
        : Math.min(BUILDER_TIMEOUT_MS, 60_000)
      : agentType === "validator"
        ? VALIDATOR_TIMEOUT_MS
        : CHECKER_TIMEOUT_MS;

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

  if (selectedProvider === "gemini") {
    return createGeminiModel(options.model || GEMINI_MODEL, temperature, maxTokens);
  }

  if (selectedProvider === "nvidia") {
    return createNvidiaModel(options.model || NVIDIA_DEEPSEEK_MODEL, temperature, maxTokens, timeout);
  }

  if (selectedProvider === "bedrock") {
    const bedrockModel = options.model || (agentType === "planner"
      ? BEDROCK_PLANNER_MODEL
      : BEDROCK_BUILDER_MODEL);
    return createBedrockModel(bedrockModel, temperature, maxTokens, timeout);
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
  GEMINI_MODEL,
  NVIDIA_DEEPSEEK_MODEL,
  BEDROCK_PLANNER_MODEL,
  BEDROCK_BUILDER_MODEL,
  GROQ_PLANNER_MODEL,
  GROQ_BUILDER_MODEL,
  AGENT_PROVIDERS,
  REQUEST_TIMEOUT_MS,
  PLANNER_TIMEOUT_MS,
  AGENT_TIMEOUT_MS,
  VALIDATOR_TIMEOUT_MS,
  CHECKER_TIMEOUT_MS,
  BUILDER_TIMEOUT_MS,
};
