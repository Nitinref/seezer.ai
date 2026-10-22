import { runReActAgent } from './runAgent.js';
import { BUILDER_TIMEOUT_MS } from '../utils/llm.js';

const WRITE_TOOLS = new Set(['create_file', 'delete_file', 'edit_files', 'write_multiple_files']);
const READ_TOOLS = new Set(['read_file', 'read_multiple_files']);
const BUILDER_MAX_READ_CALLS = 1;

const BUILDER_SYSTEM = `You are the coding agent for an existing React application in /app.

Your task is to implement the user's request using the validated build plan and the available project tools.

Rules:
- Do not call get_context or list_directory. The project context and validated plan are already provided.
- If necessary, inspect the relevant source files in one read_multiple_files call. Do not repeatedly inspect files.
- Start writing or editing project files immediately after that inspection, or immediately if the plan is sufficient.
- For a new page/app, use ONE compact write_multiple_files call. Keep the implementation focused and self-contained; do not split a simple UI into unnecessary components, data files, hooks, or pages.
- Keep each initial implementation compact and self-contained. A working single-page app is better than a large architecture that cannot fit in one reliable tool call.
- Use edit_files only for a small focused change to existing files.
- Do not install dependencies unless the plan requires a package that is not already listed in package.json.
- Preserve existing app structure and imports; keep the root route working.
- A path prefixed with @ in the user's request is an explicit target file. Read that file first and make the requested change there; do not modify unrelated files unless required by its dependencies.
- Do not claim completion until a file-writing tool has successfully changed project files.
- Return a concise summary only after making the code changes.`;

export async function runBuilderAgent({
  plan,
  userMessage,
  tools,
  timeoutMs = BUILDER_TIMEOUT_MS,
  emit,
  chatId,
  modelOptions = {},
  repair = false,
  compactFallback = false,
  forceWriteTool = false,
}) {
  let readCalls = 0;
  let wroteFiles = false;
  // Never let an agent continue consuming requests after the UI has received
  // a timeout. The old Promise.race left the LangGraph loop alive in the
  // background, which quickly exhausted free-tier Gemini quota.
  const controller = new AbortController();
  // Allow the agent enough time to inspect its own write and make a targeted
  // repair. The configured timeout is still capped to prevent runaway loops.
  const effectiveTimeoutMs = Math.min(timeoutMs, 180_000);

  const builderTools = tools
    .filter((tool) =>
      !['get_context', 'list_directory', 'save_context'].includes(tool.name)
    )
    .map((tool) => new Proxy(tool, {
      get(target, property) {
        if (property !== 'invoke') return Reflect.get(target, property, target);
        const invoke = Reflect.get(target, property, target);
        return async (input, ...args) => {
          if (READ_TOOLS.has(target.name)) {
            if (readCalls >= BUILDER_MAX_READ_CALLS) {
              throw new Error('Project inspection is limited to one call. Write the planned code now.');
            }
            readCalls += 1;
          }

          const result = await Reflect.apply(invoke, target, [input, ...args]);
          if (WRITE_TOOLS.has(target.name) && !String(result).startsWith('Tool error:')) {
            wroteFiles = true;
          }
          return result;
        };
      },
    }));

  const userPrompt = `${repair
    ? 'The previous attempt did not write any project files. Immediately write the complete implementation; do not inspect files or explain first.'
    : 'Implement the validated plan now. Inspect relevant files at most once, then write the implementation.'}
${compactFallback
  ? '\nRECOVERY MODE: Write a complete, working UI in exactly one write_multiple_files call using only src/App.jsx and src/index.css. Do not create components, hooks, pages, data, or utility files. Keep it self-contained so the tool arguments are never truncated.'
  : ''}

Validated build plan:
${JSON.stringify(plan, null, 2)}

Original user request:
${userMessage}`;

  const timeout = setTimeout(() => controller.abort(), effectiveTimeoutMs);
  try {
    const output = await runReActAgent({
      systemPrompt: BUILDER_SYSTEM,
      userPrompt,
      tools: builderTools,
      emit,
      chatId,
      temperature: 0.2,
      // The model needs room to make tool calls, not to narrate code. A
      // smaller response cap keeps normal builds responsive.
      maxTokens: repair ? 2048 : 3072,
      maxSteps: repair ? 2 : 4,
      modelType: 'builder',
      agentName: 'builder',
      modelOptions,
      // The repair agent receives only write tools, so force a tool call
      // instead of accepting another text-only response.
      // The repair tool set includes write_multiple_files. Pinning that one
      // call keeps a recovery build compact and avoids burning free-tier
      // requests by creating files individually.
      toolChoice: repair || forceWriteTool ? 'write_multiple_files' : undefined,
      // The worker already emits the real tool results. Suppress LangGraph's
      // internal node/thought events so they do not create noisy DB writes.
      emit: () => {},
      signal: controller.signal,
    });
    return { output, wroteFiles };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`BuilderAgent timeout after ${effectiveTimeoutMs / 1000}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
