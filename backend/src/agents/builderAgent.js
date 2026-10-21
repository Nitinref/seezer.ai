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
- Use write_multiple_files for new or complete files and edit_files for focused changes.
- Do not install dependencies unless the plan requires a package that is not already listed in package.json.
- Preserve existing app structure and imports; keep the root route working.
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
}) {
  let readCalls = 0;
  let wroteFiles = false;

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
          if (WRITE_TOOLS.has(target.name)) wroteFiles = true;
          return result;
        };
      },
    }));

  const userPrompt = `${repair
    ? 'The previous attempt did not write any project files. Immediately write the complete implementation; do not inspect files or explain first.'
    : 'Implement the validated plan now. Inspect relevant files at most once, then write the implementation.'}

Validated build plan:
${JSON.stringify(plan, null, 2)}

Original user request:
${userMessage}`;

  const output = await Promise.race([
    runReActAgent({
      systemPrompt: BUILDER_SYSTEM,
      userPrompt,
      tools: builderTools,
      emit,
      chatId,
      temperature: 0.2,
      maxTokens: repair ? 4096 : 8192,
      maxSteps: repair ? 2 : 6,
      modelType: 'builder',
      agentName: 'builder',
      modelOptions,
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`BuilderAgent timeout after ${timeoutMs / 1000}s`)), timeoutMs)
    ),
  ]);

  return { output, wroteFiles };
}
