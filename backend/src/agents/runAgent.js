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
  agentName = "unknown"
}) {
  const model = makeModel(modelType, temperature, maxTokens);
  
  console.log(
  `[MODEL DEBUG] Agent=${agentName} | ModelType=${modelType}`
);
  const modelWithTools = tools.length > 0 ? model.bindTools(tools) : model;
  const toolNode = tools.length > 0 ? new ToolNode(tools) : null;

  const graph = new StateGraph(AgentState).addNode("agent", async (state) => {
    const msgs = state.messages.map((m) => ({
      ...m,
      content: sanitizeContent(m.content),
    }));

    const result = await modelWithTools.invoke(msgs);
    return { messages: [result] };
  });

  if (toolNode) {
    graph
      .addNode("tools", async (state) => {
        return await toolNode.invoke(state);
      })
      .addEdge(START, "agent")
      .addConditionalEdges("agent", (state) => {
        const last = state.messages.at(-1);
        return last?.tool_calls?.length > 0 ? "tools" : END;
      })
      .addEdge("tools", "agent");
  } else {
    graph.addEdge(START, "agent").addEdge("agent", END);
  }

  const compiled = graph.compile();

  let finalState;
  let steps = 0;

  const stream = await compiled.stream(
    {
      messages: [new SystemMessage(systemPrompt), new HumanMessage(userPrompt)],
    },
    {
      recursionLimit: maxSteps * 4 + 10,
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
        let text = "";

        if (typeof last.content === "string") text = last.content;
        else if (Array.isArray(last.content))
          text = last.content.map((p) => p?.text ?? "").join("");

        if (text) {
          await emit(chatId, agentName, `🤖 ${text.slice(0, 150)}`);
        }

        if (last.tool_calls?.length) {
          for (const t of last.tool_calls) {
            await emit(chatId, agentName, `🔧 Calling tool: ${t.name}`);
          }
        }
      }

 
      if (type === "tool" || type === "ToolMessage") {
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

  if (typeof content === "string") return content;

  if (Array.isArray(content))
    return content.map((p) => (typeof p === "string" ? p : p?.text ?? "")).join("");

  return JSON.stringify(content ?? "Done.");
}
