import { StateGraph, END, START, Annotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { makeModel } from "../utils/llm.js";

function sanitizeContent(content) {
  if (content === undefined || content === null) return "(no content)";
  if (typeof content === "string") return content.trim() === "" ? "(empty)" : content;

  if (Array.isArray(content)) {
    const cleaned = content.filter(Boolean).map((p) => {
      if (typeof p === "string") return p.trim() === "" ? "(empty)" : p;
      if (p?.text !== undefined)
        return { ...p, text: p.text?.trim() === "" ? "(empty)" : p.text };
      return { type: "text", text: String(p ?? "(empty)") };
    });

    return cleaned.length > 0 ? cleaned : [{ type: "text", text: "(no content)" }];
  }

  return String(content);
}

function compactMessages(messages) {
  // Keep the system prompt, original request, and only the recent tool loop.
  // Re-sending every previous tool result makes each ReAct turn larger.
  let tailStart = messages.length > 12 ? messages.length - 10 : 0;

  // Never start the compacted history with an orphan ToolMessage. Providers
  // expect every tool result to follow the AI message that requested it;
  // cutting that pair in half causes errors like "reading message".
  if (tailStart > 2) {
    const firstTail = messages[tailStart];
    const type = firstTail?._getType?.() ?? firstTail?.role ?? firstTail?.type;
    if (type === "tool" || type === "ToolMessage") tailStart -= 1;
  }

  const kept = tailStart > 0
    ? [messages[0], messages[1], ...messages.slice(tailStart)]
    : messages;
  const seen = new Set();

  return kept.filter(Boolean).filter((message) => {
    if (seen.has(message)) return false;
    seen.add(message);
    return true;
  }).map((message, index) => {
    const content = sanitizeContent(message.content);
    const limit = index === 0 ? 14_000 : 8_000;
    return {
      ...message,
      content: typeof content === "string" ? content.slice(0, limit) : content,
    };
  });
}

function normalizeToolCalls(message) {
  const normalizeNestedArgs = (args) => {
    if (!args || typeof args !== 'object') return args;
    // Grok 4.3 occasionally serializes an array-valued function parameter a
    // second time, e.g. { files: "[{...}]" }. LangChain then rejects it
    // before the sandbox tool gets a chance to run.
    for (const key of ['files', 'edits', 'paths']) {
      if (typeof args[key] !== 'string') continue;
      try {
        const parsed = JSON.parse(args[key]);
        args[key] = Array.isArray(parsed) ? parsed : parsed?.[key] ?? args[key];
      } catch { /* keep original so the tool reports a normal validation error */ }
    }
    return args;
  };

  if (message?.tool_calls?.length) {
    message.tool_calls = message.tool_calls.map((call) => ({
      ...call,
      args: normalizeNestedArgs(call.args),
    }));
    return message;
  }

  // Some older LangChain provider adapters leave OpenAI-compatible tool
  // calls under additional_kwargs instead of setting AIMessage.tool_calls.
  // LangGraph's ToolNode only follows the normalized field.
  const rawCalls = message?.additional_kwargs?.tool_calls;
  if (!Array.isArray(rawCalls) || rawCalls.length === 0) return message;

  const toolCalls = rawCalls.map((call, index) => {
    const fn = call?.function ?? call;
    let args = fn?.arguments ?? fn?.args ?? {};
    if (typeof args === "string") {
      try { args = JSON.parse(args); } catch { args = {}; }
    }
    return {
      name: fn?.name ?? call?.name ?? "",
      args: normalizeNestedArgs(args),
      id: call?.id ?? `tool_call_${Date.now()}_${index}`,
      type: "tool_call",
    };
  }).filter((call) => call.name);

  if (!toolCalls.length) return message;
  message.tool_calls = toolCalls;
  return message;
}

const AgentState = Annotation.Root({
  messages: Annotation({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
});

export async function runReActAgent({
  systemPrompt,
  userPrompt,
  tools = [],
  temperature = 0.2,
  maxTokens = 2048,
  maxSteps = 15,
  modelType = "builder",

  // NEW
  emit = () => {},
  chatId = null,
  agentName = "unknown",
  modelOptions = {},
  toolChoice,
  stopAfterTool = false,
  abortOnMalformedWrite = false,
  signal,
  onUsage = async () => {}
}) {
  const model = makeModel(modelType, temperature, maxTokens, modelOptions);
  
  console.log(
  `[MODEL DEBUG] Agent=${agentName} | ModelType=${modelType}`
);
  // Native Bedrock Converse does not share OpenAI's forced-tool format.
  // Grok 4.3 alone uses Bedrock Mantle's OpenAI-compatible Chat Completions
  // path, so it supports forced tools.
  const usesNativeBedrockConverse = modelOptions.provider === 'bedrock'
    && modelOptions.model !== 'xai.grok-4.3';
  const modelWithTools = tools.length > 0
    ? model.bindTools(tools, toolChoice && !usesNativeBedrockConverse
      ? { tool_choice: toolChoice }
      : undefined)
    : model;
  const toolNode = tools.length > 0 ? new ToolNode(tools) : null;

  const graph = new StateGraph(AgentState).addNode("agent", async (state) => {
    const msgs = compactMessages(state.messages);

    const result = normalizeToolCalls(await modelWithTools.invoke(msgs, { signal }));
    return { messages: [result] };
  });

  if (toolNode) {
    graph
      .addNode("tools", async (state) => {
        // Some native Bedrock Qwen responses name write_multiple_files but
        // omit its required `files` argument. Passing that invalid request
        // back to the model can leave the next Converse turn hanging until
        // the whole builder timeout. Fail this build pass immediately so the
        // worker can use its bounded recovery writer instead.
        if (abortOnMalformedWrite) {
          const lastRequest = [...state.messages].reverse().find(
            (message) => Array.isArray(message?.tool_calls) && message.tool_calls.length > 0
          );
          const malformedWrite = lastRequest?.tool_calls?.find((call) =>
            call?.name === 'write_multiple_files'
            && (!Array.isArray(call?.args?.files) || call.args.files.length === 0)
          );
          if (malformedWrite) {
            throw new Error('Builder returned write_multiple_files without a files array.');
          }
        }
        return await toolNode.invoke(state);
      })
      .addEdge(START, "agent")
      .addConditionalEdges("agent", (state) => {
        const last = state.messages.at(-1);
        return last?.tool_calls?.length > 0 ? "tools" : END;
      })
      .addConditionalEdges("tools", (state) => {
        // A boolean preserves the recovery path's historical behaviour: stop
        // after its one compulsory tool call. A list only ends the loop after
        // one of those named tools, so an initial read can still be followed
        // by the planned atomic write.
        if (stopAfterTool === true) return END;
        if (Array.isArray(stopAfterTool)) {
          const lastToolRequest = [...state.messages].reverse().find(
            (message) => Array.isArray(message?.tool_calls) && message.tool_calls.length > 0
          );
          const wroteFiles = lastToolRequest?.tool_calls?.some((call) => stopAfterTool.includes(call.name));
          if (wroteFiles) return END;
        }
        return "agent";
      });
  } else {
    graph.addEdge(START, "agent").addEdge("agent", END);
  }

  const compiled = graph.compile();

  let finalState;
  let steps = 0;
  let toolCallCount = 0;

  const stream = await compiled.stream(
    {
      messages: [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)],
    },
    {
      // A graph turn is either an agent response or a tool execution. The
      // old limit (4x + 10) quietly allowed many extra read/think loops.
      // Three useful tool calls (read → write → targeted polish) require
      // seven graph nodes plus the terminating edge. Keep one small buffer
      // for that final completion turn without reopening an unbounded loop.
      recursionLimit: Math.max(4, maxSteps * 2 + 3),
      signal,
    }
  );


  for await (const chunk of stream) {
    finalState = chunk;

    const nodes = Object.keys(chunk);

    for (const node of nodes) {
        await emit(chatId, agentName, `📍 LangGraph node → ${node}`);
      const messages = chunk[node]?.messages ?? [];
      const last = messages.at(-1);

      if (!last) continue;

      const type = last._getType?.() ?? last.constructor?.name;

     
      if (type === "ai" || type === "AIMessage") {
        const usage = last.usage_metadata
          ?? last.response_metadata?.usage_metadata
          ?? last.response_metadata?.usage
          ?? last.response_metadata?.usageMetadata;
        if (usage) await onUsage(usage);
        let text = "";

        if (typeof last.content === "string") text = last.content;
        else if (Array.isArray(last.content))
          text = last.content.map((p) => p?.text ?? "").join("");

        if (text) {
          await emit(chatId, agentName, `🤖 ${text.slice(0, 150)}`);
        }

        if (last.tool_calls?.length) {
          toolCallCount += last.tool_calls.length;
          for (const t of last.tool_calls) {
            const args = t.args && typeof t.args === "object" ? t.args : {};
            const paths = [
              args.path,
              ...(Array.isArray(args.files) ? args.files.map((file) => file?.path) : []),
              ...(Array.isArray(args.edits) ? args.edits.map((edit) => edit?.path) : []),
            ].filter((path) => typeof path === "string").slice(0, 12);
            console.log(`[MODEL DEBUG] tool_call name=${t.name} argKeys=${Object.keys(args).join(',') || 'none'} paths=${paths.join(',') || 'none'}`);
            await emit(chatId, agentName, `🔧 Calling tool: ${t.name}`);
          }
        }
      }

 
      if (type === "tool" || type === "ToolMessage") {
        if (last.status === "error") {
          console.warn(`[MODEL DEBUG] tool_validation_error=${String(last.content ?? "").slice(0, 500)}`);
        }
        await emit(chatId, agentName, "✅ Tool completed");
      }
    }

    if (++steps > maxSteps * 3) break;
  }

  const allMessages = finalState
    ? Object.values(finalState).flatMap((v) => v?.messages ?? [])
    : [];

  const lastAI = [...allMessages].reverse().find(
    (m) => m._getType?.() === "ai" || m.constructor?.name === "AIMessage"
  );

  const content = lastAI?.content;

  console.log(`[MODEL DEBUG] Agent=${agentName} | toolCalls=${toolCallCount} | steps=${steps}`);

  if (typeof content === "string") return content;

  if (Array.isArray(content))
    return content.map((p) => (typeof p === "string" ? p : p?.text ?? "")).join("");

  return JSON.stringify(content ?? "Done.");
}
