import { runReActAgent } from './runAgent.js';
import { BUILDER_TIMEOUT_MS } from '../utils/llm.js';

const WRITE_TOOLS = new Set(['create_file', 'delete_file', 'edit_files', 'write_multiple_files']);
const READ_TOOLS = new Set(['read_file', 'read_multiple_files']);
const BUILDER_MAX_READ_CALLS = 1;

const QWEN_FILE_PROTOCOL = `You are generating a complete Vite React implementation.
Return source files only, using this exact format for every file:
<file path="src/example.jsx">
file contents
</file>

Do not use Markdown fences, explanations, tool calls, or prose. Include every
file required by the plan, including src/pages/Home.jsx, src/App.jsx when it is
changed, src/index.css, and every imported component/data file. Never import a
local file unless you also include that file in this response. The project
already has React, React Router, Tailwind, lucide-react, and react-icons.

Router contract: src/main.jsx owns the ONE BrowserRouter around App. App.jsx
may use Routes and Route but must never render BrowserRouter, HashRouter, or
MemoryRouter. Do not create a second router provider.

`;

function parseGeneratedFiles(output) {
  const files = [];
  const matcher = /<file\s+path=["']([^"']+)["']\s*>\s*\n?([\s\S]*?)<\/file>/gi;
  for (const match of String(output || '').matchAll(matcher)) {
    const path = match[1].trim().replace(/^\/+/, '');
    const content = match[2]
      .replace(/^```(?:jsx?|tsx?|css|javascript|typescript)?\s*\n?/i, '')
      .replace(/\n?```\s*$/, '');
    if (path.startsWith('src/') && content.trim()) files.push({ path, content });
  }
  return files;
}

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
- For a new page/app, the FIRST write must include the runnable entry files: src/pages/Home.jsx (the starter root route), src/App.jsx when needed, and src/index.css. Put the complete visible UI in those files first, then add extracted components/data in later writes. A build that creates only components while leaving the starter Home.jsx/App.jsx is incomplete and unacceptable.
- Prefer write_multiple_files, but use another write call for remaining planned files when one payload would truncate code. Never omit a planned component, import, route, or the root app merely to fit one response.
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
  initialBuild = false,
  onUsage,
}) {
  let readCalls = 0;
  let wroteFiles = false;
  let writeCalls = 0;
  // A fresh build starts with a write, but it may need more than one write
  // pass when a plan contains many components. The root files are deliberately
  // prioritised in the prompt: native Bedrock Qwen may choose create_file
  // calls even when a named tool choice was requested.
  const initialWritePath = initialBuild && !polish && !incremental;
  const bedrockFastPath = modelOptions.provider === 'bedrock' && !polish && !incremental;
  const grokMantle = modelOptions.provider === 'bedrock' && modelOptions.model === 'xai.grok-4.3';
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
      !((bedrockFastPath || initialWritePath) && READ_TOOLS.has(tool.name))
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
          const toolResult = String(result ?? '');
          let writeSucceeded = false;
          try {
            const parsed = JSON.parse(toolResult);
            writeSucceeded = parsed?.ok === true || parsed?.success === true
              || (Array.isArray(parsed?.results) && parsed.results.length > 0 && parsed.results.every((item) => item?.success !== false));
          } catch {
            // ToolNode may turn a thrown tool error into plain text.
            writeSucceeded = !/(?:tool error|\berror:|edit_files:|create_file:|write_multiple_files:|delete_file:)/i.test(toolResult);
          }
          // Sandbox tools may return either "Tool error: …" or a raw
          // operation error such as "edit_files: old_string not found".
          // Neither is a source write; counting it as one prevented the
          // worker from entering its write-only repair pass.
          const writeFailed = !writeSucceeded;
          if (WRITE_TOOLS.has(target.name) && writeFailed) {
            // Keep provider/tool failures observable without logging model
            // source payloads or entire generated files.
            console.warn(`[BuilderAgent] ${target.name} rejected: ${toolResult.slice(0, 300)}`);
          }
          if (WRITE_TOOLS.has(target.name) && !writeFailed) {
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
  ? '\nRECOVERY MODE: The primary builder may have written NOTHING. Write a complete, working UI in exactly one write_multiple_files call using only src/pages/Home.jsx and src/index.css. The starter App.jsx already routes to Home; do not leave its "Ready to build" placeholder active. Home.jsx MUST be fully self-contained: do not import ../components, ./components, data files, hooks, assets, or any local project file, and do not render an identifier that is not declared inside Home.jsx. Do not create components, hooks, pages, data, or utility files. Keep it compact so the tool arguments are never truncated.'
  : ''}
${incremental
  ? '\nINCREMENTAL UPDATE MODE: This is an existing project. First read the relevant files, then change only what the newest request requires. Preserve the existing visual design, working interactions, routes, and unrelated components. Do not replace the application with a new minimal page or scaffold.'
  : ''}
${(bedrockFastPath || initialWritePath)
  ? '\nFRESH BUILD MODE: Do not inspect starter files. Immediately write the planned implementation. Use more than one write call if needed to finish complete files; never truncate code.'
  : ''}

Validated build plan:
${JSON.stringify(plan, null, 2)}

Original user request:
${userMessage}`;

  const timeout = setTimeout(() => controller.abort(), effectiveTimeoutMs);
  try {
    // Native Bedrock coder models can emit a tool name with an empty argument
    // object. For a new app use a strict file-envelope response and perform
    // the one atomic sandbox write ourselves. Follow-ups still use normal
    // editing tools.
    const useBedrockFileProtocol = initialWritePath
      && modelOptions.provider === 'bedrock'
      && ['qwen.qwen3-coder-next', 'deepseek.v3.2'].includes(modelOptions.model);
    if (useBedrockFileProtocol) {
      const generated = await runReActAgent({
        systemPrompt: QWEN_FILE_PROTOCOL,
        userPrompt,
        tools: [],
        emit: () => {},
        chatId,
        temperature: 0.2,
        maxTokens: modelOptions.model === 'deepseek.v3.2' ? 4096 : 8192,
        maxSteps: 1,
        modelType: 'builder',
        agentName: 'builder',
        modelOptions,
        signal: controller.signal,
        onUsage,
      });
      const files = parseGeneratedFiles(generated);
      const hasRoot = files.some((file) => file.path === 'src/pages/Home.jsx' || file.path === 'src/App.jsx');
      if (!hasRoot || files.length < 2) {
        console.warn(`[BuilderAgent] Incomplete file envelope: chars=${String(generated || '').length} files=${files.length} paths=${files.map((file) => file.path).join(',') || 'none'}`);
        throw new Error('Bedrock builder returned an incomplete file-envelope response.');
      }
      const writer = builderTools.find((tool) => tool.name === 'write_multiple_files');
      if (!writer) throw new Error('write_multiple_files tool is unavailable.');
      await writer.invoke({ files });
      if (!wroteFiles) throw new Error('Bedrock file-envelope write was rejected by the sandbox.');
      return { output: 'Implemented the requested interface and wrote the project files.', wroteFiles: true };
    }

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
      // Component-heavy apps do not fit reliably in a 6K atomic tool JSON.
      // Groq's free Qwen tier rejects requests whose declared output ceiling
      // exceeds its 1K OTPM allowance. Recovery writes are deliberately just
      // Home.jsx + index.css, so keep that emergency path under the limit.
      maxTokens: compactFallback
        ? (modelOptions.provider === 'groq' ? 900 : 8192)
        : bedrockFastPath ? 8192 : repair ? 6144 : polish ? 4096 : 6144,
      // A fresh app can use multiple write passes; edits remain focused.
      // Qwen may emit one create_file call per turn. Four turns allowed it to
      // produce isolated components then hit the cap before App.jsx, leaving
      // the starter "Ready to build" screen in preview. Give fresh builds a
      // realistic tool budget; incremental edits stay constrained.
      maxSteps: repair || incremental ? 2 : 8,
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
      // Bedrock Mantle Grok honours the standard OpenAI "required" mode
      // more reliably than a forced named function. In the fresh/repair
      // paths it only sees write tools, so required still means a file write.
      toolChoice: repair || forceWriteTool || initialWritePath || (modelOptions.provider === 'bedrock' && !incremental)
        ? (grokMantle ? 'required' : 'write_multiple_files')
        : undefined,
      // Only compact recovery is intentionally single-write. Full Qwen builds
      // may need a second write to finish all planned components.
      // Once Bedrock Qwen has produced its initial atomic project write, do
      // not let it enter a second tool loop and overwrite that valid result
      // with a partial rewrite. If it creates individual files instead, it
      // still receives the normal fresh-build budget.
      stopAfterTool: initialWritePath && modelOptions.provider === 'bedrock'
        ? ['write_multiple_files']
        : incremental
          ? [...WRITE_TOOLS]
          : compactFallback && forceWriteTool
            ? true
            : false,
      // Do not spend the full 120-second builder window when native Bedrock
      // Qwen sends a named write tool with no `files` payload. The worker
      // immediately switches to its compact recovery writer in that case.
      abortOnMalformedWrite: initialWritePath && modelOptions.provider === 'bedrock',
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
    if (/recursion limit/i.test(String(error?.message ?? error))) {
      if (wroteFiles) {
        return { output: 'Implementation files were written before the builder reached its tool-turn budget; continuing with verification.', wroteFiles: true };
      }
      return { output: 'Builder reached its tool-turn budget before writing files.', wroteFiles: false };
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
