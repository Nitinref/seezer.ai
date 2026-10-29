import { runReActAgent } from './runAgent.js';
import { BUILDER_TIMEOUT_MS } from '../utils/llm.js';

const WRITE_TOOLS = new Set(['create_file', 'delete_file', 'edit_files', 'write_multiple_files']);
const READ_TOOLS = new Set(['read_file', 'read_multiple_files']);
const BUILDER_MAX_READ_CALLS = 1;

const BUILDER_SYSTEM = `You are the coding agent for an existing React application in /app.

Your task is to implement the user's request using the validated build plan and the available project tools.

The plan may contain a UI brief. Treat it as the source of truth for visual
direction: create a polished, responsive interface with intentional hierarchy,
typography, spacing, and interaction states. For substantial experiences,
prefer a small set of focused components over a generic one-file mockup.

QUALITY BAR:
- Build a real, presentation-ready interface, not a wireframe or a text document.
- Every substantial page needs a clear visual hierarchy: a distinctive hero or
  primary surface, deliberate section rhythm, and thoughtfully designed cards,
  controls, and hover/focus states where relevant.
- Never default to a plain black terminal, raw bullet lists, unstyled links, or
  a generic dashboard unless the user explicitly asks for that visual language.
- Avoid repeating placeholder-like copy. Use the request to create a specific
  visual identity, useful content grouping, and a responsive mobile layout.
- If the request explicitly asks for a terminal aesthetic, make it feel like a
  crafted product interface with strong hierarchy and interaction feedback,
  not a browser page containing plain terminal text.
- Execute the visual brief as a system: define consistent colour roles, a
  readable type scale, spacing tokens, component radii, shadows, and states.
  Do not scatter unrelated one-off styles across the page.
- Make the first viewport compelling: give the hero a clear focal point and
  support it with an intentional composition, not just a large heading above
  paragraphs. Use imagery, illustration-like CSS, data visualisation, or a
  structured product surface only when appropriate to the request.
- Vary information density across sections. A page should have hierarchy and
  pacing rather than identical full-width cards or repeated text blocks.

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
  polish = false,
  compactFallback = false,
  forceWriteTool = false,
  incremental = false,
  onUsage,
}) {
  let readCalls = 0;
  let wroteFiles = false;
  let writeCalls = 0;
  // Bedrock Qwen has high latency between ReAct turns. For normal builds,
  // give it only the one atomic write path so it cannot spend a full model
  // request reading and then another one deciding to write.
  const bedrockFastPath = modelOptions.provider === 'bedrock' && !polish && !incremental;
  // Never let an agent continue consuming requests after the UI has received
  // a timeout. The old Promise.race left the LangGraph loop alive in the
  // background, which quickly exhausted free-tier Gemini quota.
  const controller = new AbortController();
  // Allow the agent enough time to inspect its own write and make a targeted
  // repair. The configured timeout is still capped to prevent runaway loops.
  const effectiveTimeoutMs = Math.min(timeoutMs, 180_000);

  const builderTools = tools
    .filter((tool) =>
      !['get_context', 'list_directory', 'save_context'].includes(tool.name) &&
      !(bedrockFastPath && READ_TOOLS.has(tool.name))
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

          // Recovery builds intentionally produce the complete UI in one
          // write_multiple_files request. Prevent an agent from overwriting
          // that finished implementation with an incomplete follow-up pass.
          if (compactFallback && WRITE_TOOLS.has(target.name) && writeCalls >= 1) {
            return 'Recovery mode accepts exactly one successful write. Review the existing result and return your summary without modifying files.';
          }

          const result = await Reflect.apply(invoke, target, [input, ...args]);
          if (WRITE_TOOLS.has(target.name) && String(result).startsWith('Tool error:')) {
            // Keep provider/tool failures observable without logging model
            // source payloads or entire generated files.
            console.warn(`[BuilderAgent] ${target.name} rejected: ${String(result).slice(0, 300)}`);
          }
          if (WRITE_TOOLS.has(target.name) && !String(result).startsWith('Tool error:')) {
            writeCalls += 1;
            wroteFiles = true;
          }
          return result;
        };
      },
    }));

  const userPrompt = `${polish
    ? 'Review the implementation against the UI direction below. Inspect the relevant source files once, then make a focused visual-polish edit. Remove any wireframe, plain-text, or generic-template feel. Check the first viewport, visual hierarchy, type scale, palette roles, section rhythm, component states, and real mobile composition. Improve the weakest two areas with deliberate code changes. Preserve working functionality and do not rewrite unrelated code.'
    : repair
    ? 'The previous attempt did not write any project files. Immediately write the complete implementation; do not inspect files or explain first.'
    : 'Implement the validated plan now. Inspect relevant files at most once, then write the implementation.'}
${compactFallback
  ? '\nRECOVERY MODE: Write a complete, working UI in exactly one write_multiple_files call using only src/App.jsx and src/index.css. Do not create components, hooks, pages, data, or utility files. Keep it self-contained so the tool arguments are never truncated.'
  : ''}
${incremental
  ? '\nINCREMENTAL UPDATE MODE: This is an existing project. First read the relevant files, then change only what the newest request requires. Preserve the existing visual design, working interactions, routes, and unrelated components. Do not replace the application with a new minimal page or scaffold.'
  : ''}
${bedrockFastPath
  ? '\nFAST BEDROCK MODE: Do not inspect files. Immediately make exactly one write_multiple_files call containing every complete file required by the validated plan. Then stop. Do not call any other tool or provide a preamble.'
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
      // A compact recovery still writes a complete App.jsx plus stylesheet.
      // 2–4K output tokens can cut the JSON tool arguments mid-file, which
      // LangChain reports as an invalid/truncated tool call. Give only this
      // write-first path enough room to finish its single atomic write.
      // Most Vite apps fit comfortably in this budget. Keeping the initial
      // one-shot Bedrock response bounded avoids multi-minute generations;
      // compiler repair handles the rare invalid output afterward.
      maxTokens: compactFallback ? 8192 : bedrockFastPath ? 6144 : repair ? 4096 : polish ? 4096 : 4096,
      // Implement and polish each get an intentional inspect/write/complete
      // budget instead of an open-ended ReAct loop.
      maxSteps: repair || incremental ? 2 : 3,
      modelType: 'builder',
      agentName: 'builder',
      modelOptions,
      // The repair agent receives only write tools, so force a tool call
      // instead of accepting another text-only response.
      // The repair tool set includes write_multiple_files. Pinning that one
      // call keeps a recovery build compact and avoids burning free-tier
      // requests by creating files individually.
      // Bedrock Qwen is fast when it sends the whole project as one atomic
      // write, but can otherwise create files one at a time. Pin the tool so
      // new builds need one request and one tool execution, not a slow chain.
      toolChoice: repair || forceWriteTool || (modelOptions.provider === 'bedrock' && !incremental)
        ? 'write_multiple_files'
        : undefined,
      // Qwen Coder writes the full app atomically but can then leave a slow
      // follow-up turn open only to narrate a summary. Let it inspect first,
      // but terminate immediately after the first successful file write.
      // Compact recovery still stops after its mandatory one tool call.
      stopAfterTool: incremental
        ? [...WRITE_TOOLS]
        : compactFallback && forceWriteTool
        ? true
        : modelOptions.provider === 'bedrock' && !incremental
          ? [...WRITE_TOOLS]
          : false,
      // The worker already emits the real tool results. Suppress LangGraph's
      // internal node/thought events so they do not create noisy DB writes.
      emit: () => {},
      signal: controller.signal,
      onUsage,
    });
    const compactSummary = (compactFallback || modelOptions.provider === 'bedrock') && wroteFiles
      ? 'Implemented the requested interface and wrote the project files.'
      : output;
    return { output: compactSummary, wroteFiles };
  } catch (error) {
    if (controller.signal.aborted) {
      // Tool writes are atomic. If the model times out while attempting a
      // non-essential follow-up response, preserve the completed files and
      // let deterministic verification decide whether the build is usable.
      if (wroteFiles) {
        return { output: 'Implementation files were written before the builder timed out; continuing with verification.', wroteFiles: true };
      }
      throw new Error(`BuilderAgent timeout after ${effectiveTimeoutMs / 1000}s`);
    }
    // The implementation may already be safely written when a provider rate
    // limit hits the final “summarise/continue” model turn. Do not discard a
    // real file write just because that non-essential response was rejected;
    // the worker will run deterministic build verification next.
    if (wroteFiles && /(?:\b429\b|rate.?limit|quota)/i.test(String(error?.message ?? error))) {
      return { output: 'Implementation files were written; continuing with verification.', wroteFiles: true };
    }
    // Some OpenRouter free routes repeatedly emit incomplete/unsupported tool
    // calls until LangGraph reaches its cap. Let the worker use its existing
    // forced write-only recovery pass instead of failing the entire job or
    // raising the cap and spending even more model turns.
    if (!wroteFiles && /recursion limit/i.test(String(error?.message ?? error))) {
      return { output: 'Builder reached its tool-turn budget before writing files.', wroteFiles: false };
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
