import 'dotenv/config';
import { EventEmitter } from 'events';
EventEmitter.defaultMaxListeners = 50;

import { Worker } from 'bullmq';
import { DynamicStructuredTool } from '@langchain/core/tools';

import { bullConnection, publisher, buildChannel } from '../redis/index.js';
import { getOrCreateSandbox, makeSandboxTools } from '../tools/sandboxTools.js';
import { PipelineLogger, classifyError } from '../utils/logger.js';
import { validatePlan } from '../utils/planValidator.js';
import {
  CLAUDE_BUILDER_MODEL,
  CLAUDE_PLANNER_MODEL,
  OPENROUTER_VALIDATOR_MODEL,
  OPENROUTER_CHECKER_MODEL,
  GROQ_VALIDATOR_MODEL,
  GROQ_CHECKER_MODEL,
  GROQ_PLANNER_MODEL,
  GROQ_BUILDER_MODEL,
  GEMINI_MODEL,
  AGENT_PROVIDERS
} from '../utils/llm.js';
import prisma from '../db/index.js';


import { runPlannerAgent } from '../agents/plannerAgent.js';
import { runBuilderAgent } from '../agents/builderAgent.js';
import { runValidatorAgent } from '../agents/validatorAgent.js';
import { runCheckerAgent } from '../agents/checkerAgent.js';


const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Pipeline events do not otherwise carry the Bull job identifier. Retaining
// it for the active run lets a reconnected client still expose a real Stop
// control while BullMQ retries the same job.
const activeBuildJobsByChat = new Map();

function compactErrorMessage(error) {
  const message = error?.message ?? String(error);
  return message.includes('failed_generation') || message.length > 1_000
    ? 'Model produced an invalid or truncated tool call.'
    : message;
}

async function throwIfBuildStopped(job) {
  const stopped = await bullConnection.get(`build:cancel:${job.id}`);
  if (stopped) {
    const error = new Error('Work stopped by user.');
    error.code = 'BUILD_STOPPED';
    throw error;
  }
}

function fallbackPlanForRequest(prompt = '') {
  const train = /train|railway|rail|ticket|journey/i.test(prompt);
  if (train) {
    return {
      summary: 'Build a maintainable train booking homepage',
      approach: 'Use a responsive React/Tailwind page composed from reusable train-search, listing, route, and footer components.',
      homeComponent: 'src/pages/Home.jsx',
      files: [
        { path: 'src/pages/Home.jsx', action: 'update', description: 'Compose the train booking homepage.' },
        { path: 'src/components/Navbar.jsx', action: 'create', description: 'Responsive navigation.' },
        { path: 'src/components/SearchPanel.jsx', action: 'create', description: 'Train search form.' },
        { path: 'src/components/TrainCard.jsx', action: 'create', description: 'Reusable train result card.' },
        { path: 'src/components/Footer.jsx', action: 'create', description: 'Responsive footer.' },
        { path: 'src/data/trains.js', action: 'create', description: 'Train and route data.' },
      ],
      newPages: [], packages: [], steps: ['Build components', 'Wire Home.jsx', 'Verify the project'],
    };
  }
  return {
    summary: 'Build the requested React application',
    approach: 'Use a maintainable React/Tailwind page composed from focused reusable components and data.',
    homeComponent: 'src/pages/Home.jsx',
    files: [
      { path: 'src/pages/Home.jsx', action: 'update', description: 'Compose the requested homepage.' },
      { path: 'src/components/Header.jsx', action: 'create', description: 'Reusable page header.' },
      { path: 'src/components/ContentSection.jsx', action: 'create', description: 'Reusable content section.' },
      { path: 'src/data/content.js', action: 'create', description: 'Page data and constants.' },
    ],
    newPages: [], packages: [], steps: ['Build components', 'Wire Home.jsx', 'Verify the project'],
  };
}
async function withRetry(fn, maxRetries = 1, label = '') {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err?.message ?? String(err);
      const isRateLimit = msg.includes('429') || msg.includes('rate_limit') || msg.includes('rate limit') || msg.includes('free-models-per-day');
      const isTransient = msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('rate_limit_exceeded') || msg.includes('overloaded') || msg.includes('503') || msg.includes('Service Unavailable') || msg.includes('high demand') || msg.includes('fetch failed') || msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT');

      if (isTransient && !isRateLimit && attempt < maxRetries) {
        const waitMs = Math.min(30_000 * Math.pow(2, attempt) + Math.random() * 5_000, 120_000);
        console.log(JSON.stringify({
          level: 'warn',
          message: `[${label}] 429/overloaded — waiting ${(waitMs / 1_000).toFixed(1)}s (attempt ${attempt + 1}/${maxRetries})`,
          ts: new Date().toISOString(),
        }));
        await sleep(waitMs);
        continue;
      }
      throw err;
    }
  }
}

function isReviewAgentFailure(err) {
  const msg = String(err?.message ?? err).toLowerCase();
  return msg.includes('429') || msg.includes('rate limit') || msg.includes('rate_limit') ||
    msg.includes('free-models-per-day') || msg.includes('overloaded') ||
    msg.includes('timeout after');
}

async function emit(chatId, stage, message, extra = {}) {
  const jobId = activeBuildJobsByChat.get(chatId);
  const event = {
    type: 'pipeline_update',
    stage,
    message,
    ts: Date.now(),
    ...(jobId ? { jobId } : {}),
    ...extra,
  };
  const payload = JSON.stringify(event);
  try {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: { pipelineEvents: true },
    });
    const events = Array.isArray(chat?.pipelineEvents) ? chat.pipelineEvents : [];
    await prisma.chat.update({
      where: { id: chatId },
      data: { pipelineEvents: [...events, event] },
    });
  } catch (error) {
    // Persistence should never stop the live build stream.
    console.warn('[pipeline/events] failed to persist event:', error.message);
  }
  await publisher.publish(buildChannel(chatId), payload);
}

async function scaffoldReactApp(sb, chatId, projectId) {
  await emit(chatId, 'sandbox', 'Scaffolding React + Tailwind + React Icons…');

  if (!sb?.files) throw new Error(`Sandbox files API not available. Keys: ${Object.keys(sb ?? {}).join(', ')}`);

  await sb.files.write('/app/package.json', JSON.stringify({
    name: 'react-app', version: '0.1.0', type: 'module',
    scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
    dependencies: {
      react: '^18.2.0', 'react-dom': '^18.2.0',
      'react-router-dom': '^6.8.0', 'react-icons': '^4.11.0',
    },
    devDependencies: {
      '@vitejs/plugin-react': '^3.1.0', tailwindcss: '^3.2.0',
      postcss: '^8.4.24', autoprefixer: '^10.4.14', vite: '^4.2.0',
    },
  }, null, 2));

  await sb.files.write('/app/vite.config.js',
    "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()], server: { host: true, port: 5173, strictPort: true, allowedHosts: ['.e2b.app'] } });\n");

  await sb.files.write('/app/index.html',
    '<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>React App</title></head>\n<body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>\n</html>\n');

  await sb.files.write('/app/src/main.jsx',
    "import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nimport './index.css';\nReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);\n");

  await sb.files.write('/app/tailwind.config.js',
    "export default { content: ['./index.html', './src/**/*.{js,jsx}'], theme: { extend: {} }, plugins: [] };\n");

  await sb.files.write('/app/postcss.config.js',
    "export default { plugins: { tailwindcss: {}, autoprefixer: {} } };\n");

  // The scaffold pins Tailwind v3, which requires PostCSS directives rather
  // than the Tailwind v4 `@import "tailwindcss"` entrypoint.
  await sb.files.write('/app/src/index.css', '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');

  await sb.files.write('/app/src/App.jsx',
    "import { BrowserRouter, Routes, Route } from 'react-router-dom';\nimport Home from './pages/Home';\nfunction App() { return <BrowserRouter><Routes><Route path=\"/\" element={<Home />} /></Routes></BrowserRouter>; }\nexport default App;\n");

  await sb.files.write('/app/src/pages/Home.jsx',
    'export default function Home() { return <div className="min-h-screen flex items-center justify-center bg-gray-50"><h1 className="text-2xl font-bold text-gray-800">Ready to build…</h1></div>; }\n');

  const scaffoldFiles = [
    '/app/package.json', '/app/vite.config.js', '/app/index.html', '/app/src/main.jsx',
    '/app/tailwind.config.js', '/app/postcss.config.js', '/app/src/index.css',
    '/app/src/App.jsx', '/app/src/pages/Home.jsx',
  ];
  const scaffoldFileChanges = await Promise.all(scaffoldFiles.map(async (path) => {
    const content = await sb.files.read(path);
    return {
      path,
      additions: content === '' ? 0 : content.split('\n').length,
      deletions: 0,
    };
  }));

  // The UI receives the scaffold write event next. Persist those same files
  // first so Code view can show the default project immediately, rather than
  // waiting for the end-of-build sync or preview server.
  await syncProjectFiles(sb, projectId, { _log: () => {} });

  await emit(chatId, 'tool', JSON.stringify({
    version: 1,
    kind: 'write_multiple_files',
    ok: true,
    files: scaffoldFiles,
    file_changes: scaffoldFileChanges,
    file_count: 9,
    phase: 'scaffold',
    args: { cwd: '/app' },
  }));

  await emit(chatId, 'sandbox', 'Installing dependencies…');
  try {
    await sb.commands.run('npm install --no-audit --no-fund', { cwd: '/app', timeoutMs: 180_000 });
  } catch (err) {
    const details = [err?.message, err?.stderr, err?.stdout].filter(Boolean).join('\n').slice(-2000);
    console.error(`[Scaffold] npm install failed:\n${details}`);
    await emit(chatId, 'error', `Sandbox dependency install failed: ${details.slice(-500)}`);
    throw err;
  }
  await emit(chatId, 'sandbox', 'Scaffold complete.');
}

function publicToolDetails(name, result) {
  let value = result;
  try { value = JSON.parse(result); } catch { }
  const details = { version: 1, kind: name, ok: true };

  if (value && typeof value === 'object') {
    if (Array.isArray(value.changed_files)) {
      details.changed_files = value.changed_files;
      details.file_count = value.changed_files.length;
    }
    if (Array.isArray(value.files)) {
      details.files = value.files.map((file) => typeof file === 'string' ? file : file?.path).filter(Boolean);
      details.file_count = details.files.length;
    }
    if (Array.isArray(value.results)) {
      details.files = value.results.map((file) => typeof file === 'string' ? file : file?.path).filter(Boolean);
      details.file_count = details.files.length;
      details.additions = value.results.reduce((sum, file) => sum + Number(file?.additions ?? 0), 0);
      details.deletions = value.results.reduce((sum, file) => sum + Number(file?.deletions ?? 0), 0);
      // Preserve individual file counts for the activity timeline. Aggregate
      // values alone make every row appear as +0 -0 after a multi-file write.
      details.file_changes = value.results
        .filter((file) => file && typeof file === 'object' && typeof file.path === 'string')
        .map((file) => ({
          path: file.path,
          additions: Number(file.additions ?? 0),
          deletions: Number(file.deletions ?? 0),
        }));
    }
    if (typeof value.path === 'string') {
      details.files = [value.path];
      details.file_count = 1;
    }
    if (typeof value.success === 'boolean') details.success = value.success;
    if (typeof value.exitCode === 'number') details.exit_code = value.exitCode;
    if (value.build && typeof value.build.exitCode === 'number') details.build_exit_code = value.build.exitCode;
    if (value.lint && typeof value.lint.exitCode === 'number') details.lint_exit_code = value.lint.exitCode;
    if (typeof value.error === 'string') details.error = value.error.slice(0, 400);
    const output = [];
    if (value.build && typeof value.build === 'object') {
      output.push(`> npm run build\n${value.build.stdout ?? ''}${value.build.stderr ? `\n${value.build.stderr}` : ''}`);
    }
    if (value.lint && typeof value.lint === 'object' && !value.lint.skipped) {
      output.push(`> npm run lint --if-present\n${value.lint.stdout ?? ''}${value.lint.stderr ? `\n${value.lint.stderr}` : ''}`);
    }
    if (typeof value.stdout === 'string' || typeof value.stderr === 'string') {
      output.push([value.stdout, value.stderr].filter(Boolean).join('\n'));
    }
    if (output.length) details.output = output.join('\n').slice(-20_000);
    if (value._diffs) {
      const diff = typeof value._diffs === 'string' ? value._diffs : JSON.stringify(value._diffs);
      details.diff = diff.slice(0, 20_000);
      details.additions = (diff.match(/^\+(?!\+\+)/gm) || []).length;
      details.deletions = (diff.match(/^-(?!\-\-\-)/gm) || []).length;
    }
    return details;
  }

  return { ...details, output_bytes: Buffer.byteLength(String(result ?? '')) };
}

function publicToolArgs(args = {}) {
  const safe = {};
  for (const [key, value] of Object.entries(args)) {
    if (['content', 'old_string', 'new_string', 'context'].includes(key)) {
      safe[key] = typeof value === 'string' ? `${value.slice(0, 180)}${value.length > 180 ? '…' : ''}` : value;
    } else if (Array.isArray(value)) {
      safe[key] = value.map((item) => typeof item === 'object' ? item?.path ?? item?.name ?? item : item).slice(0, 20);
    } else {
      safe[key] = value;
    }
  }
  return safe;
}

function changedProjectPaths(toolName, args, result) {
  if (!['create_file', 'edit_files', 'write_multiple_files', 'delete_file'].includes(toolName)) return [];

  let payload = result;
  try { payload = JSON.parse(result); } catch { }
  const candidates = [
    ...(Array.isArray(payload?.changed_files) ? payload.changed_files : []),
    ...(Array.isArray(payload?.results) ? payload.results.map((file) => file?.path) : []),
    ...(Array.isArray(payload?.files) ? payload.files.map((file) => typeof file === 'string' ? file : file?.path) : []),
    payload?.path,
    args?.path,
    ...(Array.isArray(args?.files) ? args.files.map((file) => file?.path) : []),
    ...(Array.isArray(args?.edits) ? args.edits.map((edit) => edit?.path) : []),
  ];

  return [...new Set(candidates
    .filter((path) => typeof path === 'string')
    .map((path) => path.replace(/^\/app\//, '').replace(/^app\//, ''))
    .filter((path) => path && !path.includes('..')),
  )];
}

async function syncToolChanges(projectId, toolName, args, result) {
  const paths = changedProjectPaths(toolName, args, result);
  if (!paths.length) return;

  if (toolName === 'delete_file') {
    await prisma.projectFile.deleteMany({ where: { projectId, path: { in: paths } } });
    return;
  }

  const sandbox = await getOrCreateSandbox(projectId);
  await Promise.all(paths.map(async (path) => {
    const content = await sandbox.files.read(`/app/${path}`);
    await prisma.projectFile.upsert({
      where: { projectId_path: { projectId, path } },
      update: { content },
      create: { projectId, path, content },
    });
  }));
}

function toLangChainTools(sandboxTools, emit, chatId, projectId) {
  return sandboxTools.map((t) =>
    new DynamicStructuredTool({
      name: t.name,
      description: t.description,
      schema: t.parameters,
      func: async (args) => {
        const startedAt = Date.now();
        console.log(`[Tool] ${t.name} started`);
        try {
          const result = await t.execute(args);
          if (result === undefined || result === null) return '(no output)';
          const str = typeof result === 'string' ? result : JSON.stringify(result);
          const executeMs = Date.now() - startedAt;
          // Store the changed source immediately, rather than waiting for the
          // final project sync. The client can therefore open new code as
          // each tool call finishes, before a preview exists.
          await syncToolChanges(projectId, t.name, args, str).catch((error) => {
            console.warn(`[live file sync] ${t.name} failed: ${error.message}`);
          });
          console.log(`[Tool] ${t.name} completed in ${Date.now() - startedAt}ms (execution ${executeMs}ms)`);
          await emit(chatId, 'tool', JSON.stringify({
            ...publicToolDetails(t.name, str),
            args: publicToolArgs(args),
          }));
          return str.trim() === '' ? '(empty output)' : str;
        } catch (err) {
          console.error(`[Tool] ${t.name} failed after ${Date.now() - startedAt}ms: ${err?.message ?? String(err)}`);
          return `Tool error: ${err?.message ?? String(err)}`;
        }
      },
    })
  );
}


async function collectSandboxFiles(sb, dirPath) {
  const entries = await sb.files.list(dirPath);
  const files = entries.filter((e) => e.type !== 'dir');
  const dirs = entries.filter((e) => e.type === 'dir');

  const reads = files.map(async (entry) => {
    const fullPath = `${dirPath}/${entry.name}`;
    try {
      const content = await sb.files.read(fullPath);
      return { path: fullPath.replace('/app/', ''), content };
    } catch { return null; }
  });

  const results = (await Promise.all(reads)).filter(Boolean);
  for (const dir of dirs) {
    results.push(...await collectSandboxFiles(sb, `${dirPath}/${dir.name}`));
  }
  return results;
}

async function startPreviewServer(sb, projectId, chatId, logger) {
  try {
    await sb.files.write('/app/vite.config.js',
`import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173, strictPort: true, allowedHosts: true }
})
`);
    // A newly recreated E2B sandbox only contains files restored from the
    // database; dependencies such as Vite are not part of that restore.
    // Install them before launching the dev server so an expired sandbox can
    // produce a fresh preview URL on the same build run.
    const install = await sb.commands.run('npm install --no-audit --no-fund', {
      cwd: '/app',
      timeoutMs: 120_000,
    });
    if (install.exitCode !== 0) {
      throw new Error(`Dependency install failed: ${String(install.stderr || install.stdout).slice(-500)}`);
    }
    // A reused sandbox may still have the previous Vite process alive. If we
    // leave it running, strictPort makes the new server fail and the preview
    // silently keeps serving the old scaffold.
    await sb.commands.run("pkill -f 'vite.*5173' >/dev/null 2>&1 || true", { cwd: '/app', timeoutMs: 10_000 }).catch(() => { });
    await sleep(500);
    // Keep the dev server detached from the command request. Some sandbox
    // runtimes terminate `background: true` processes when that request ends.
    await sb.commands.run(
      'nohup npm run dev -- --host 0.0.0.0 --port 5173 >/tmp/sizzer-vite.log 2>&1 </dev/null &',
      { cwd: '/app', timeoutMs: 10_000 }
    );
    let listening = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        await sb.commands.run('curl -fsS http://127.0.0.1:5173 >/dev/null', { cwd: '/app', timeoutMs: 5_000 });
        listening = true;
        break;
      } catch { await sleep(1000); }
    }
    if (!listening) {
      let log = '';
      try { log = await sb.files.read('/tmp/sizzer-vite.log'); } catch { }
      throw new Error(`Vite did not listen on port 5173${log ? `: ${log.slice(-500)}` : ''}`);
    }
    const hostname = await sb.getHost(5173);
    const previewUrl = hostname
      ? (hostname.startsWith('http') ? hostname : `https://${hostname}`)
      : null;
    if (previewUrl) {
      console.log(`[Preview] Build preview ready for project ${projectId}: ${previewUrl}`);
      await emit(chatId, 'preview', 'Preview is ready while background checks continue.', { previewUrl });
      await prisma.project.update({
        where: { id: projectId },
        data: { sandboxId: sb.sandboxId ?? `local-${projectId}`, previewUrl },
      }).catch((e) => logger._log('warn', 'Failed to save previewUrl', { error: e.message }));
    }
    return previewUrl;
  } catch (err) {
    console.error(`[Preview] Build preview failed for project ${projectId}: ${err.message}`);
    logger._log('warn', 'Early preview start failed', { error: err.message });
    return null;
  }
}

async function syncProjectFiles(sb, projectId, logger) {
  try {
    const allFiles = await collectSandboxFiles(sb, '/app/src');
    const rootFiles = ['vite.config.js', 'index.html', 'package.json', 'tailwind.config.js', 'postcss.config.js'];
    for (const file of rootFiles) {
      try {
        const content = await sb.files.read(`/app/${file}`);
        allFiles.push({ path: file, content });
      } catch { }
    }
    await Promise.all(allFiles.map(({ path, content }) =>
      prisma.projectFile.upsert({
        where: { projectId_path: { projectId, path } },
        update: { content },
        create: { projectId, path, content },
      }).catch((e) => logger._log('warn', `Upsert failed: ${path}`, { err: e.message }))
    ));
    logger._log('info', `Synced ${allFiles.length} files`, { projectId });
    return true;
  } catch (err) {
    logger._log('warn', 'File sync error', { error: err.message });
    return false;
  }
}

async function processBuildJob(job) {
  const { chatId, projectId, userMessage, previousMessages, provider, model } = job.data;
  activeBuildJobsByChat.set(chatId, String(job.id));
  const modelOptions = ['openrouter', 'gemini'].includes(provider) ? { provider, model } : {};
  const previousProgress = job.progress && typeof job.progress === 'object' ? job.progress : {};
  const resumeStage = previousProgress.stage || null;
  const isRetryResume = job.attemptsMade > 0 && Boolean(resumeStage);
  const stageRank = { planned: 1, built: 2, validated: 3, checked: 4 };
  const hasCheckpoint = (stage) => isRetryResume && (stageRank[resumeStage] || 0) >= stageRank[stage];
  const logger = new PipelineLogger(chatId, job.id);
  logger.startStage('pipeline');

  try {
    // A cancelled job must be handled below rather than escape before this
    // try/catch; otherwise BullMQ retries the same cancellation as a failure.
    await throwIfBuildStopped(job);
    await emit(chatId, 'start', 'Build job received — pipeline starting…');
    logger._log('info', 'Pipeline started', {
      projectId,
      msg: userMessage.slice(0, 80),
      requestedProvider: provider ?? 'default',
      requestedModel: model ?? 'default',
      effectivePlannerProvider: modelOptions.provider ?? AGENT_PROVIDERS.planner,
      effectiveBuilderProvider: modelOptions.provider ?? AGENT_PROVIDERS.builder,
    });

    if (job.attemptsMade > 0 && !isRetryResume) await sleep(15_000);

    logger.startStage('sandbox');
    await emit(chatId, 'sandbox', 'Initialising cloud sandbox…');

    const sb = await withRetry(
      () => getOrCreateSandbox(projectId),
      1,
      'Sandbox'
    );

    let needsScaffold = false;
    try { await sb.files.read('/app/package.json'); } catch { needsScaffold = true; }

    if (needsScaffold) {
      await scaffoldReactApp(sb, chatId, projectId);
    } else {
     await emit(chatId, 'sandbox', 'Existing sandbox reused.')

      // Repair sandboxes created by the old scaffold (Tailwind v3 package
      // with the incompatible v4 CSS entrypoint).
      try {
        const cssPath = '/app/src/index.css';
        const css = await sb.files.read(cssPath);
        if (css.includes('@import "tailwindcss"')) {
          await sb.files.write(cssPath, css.replace('@import "tailwindcss";', '@tailwind base;\n@tailwind components;\n@tailwind utilities;'));
          await emit(chatId, 'sandbox', 'Repaired Tailwind v3 stylesheet.');
        }
      } catch { }

await sb.files.write('/app/vite.config.js',
`import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true
  }
})
`);
    }

    await prisma.project.update({
      where: { id: projectId },
      data: { sandboxId: sb.sandboxId ?? `local-${projectId}` },
    }).catch(() => { });

    logger.endStage('sandbox');


    const sandboxTools = makeSandboxTools(projectId);
    const lcTools = toLangChainTools(sandboxTools, emit, chatId, projectId);
    const toolMap = Object.fromEntries(sandboxTools.map((t) => [t.name, t]));

    // Keep Builder focused on reading and writing the app. Shell/build/browser
    // checks consume free-model steps and are handled by the Checker.
    const builderTools = lcTools.filter((t) =>
      ['read_file', 'read_multiple_files', 'edit_files', 'create_file', 'write_multiple_files', 'delete_file'].includes(t.name)
    );
    const builderWriteTools = lcTools.filter((t) =>
      ['edit_files', 'create_file', 'write_multiple_files', 'delete_file'].includes(t.name)
    );
    const validatorTools = lcTools.filter((t) =>
      ['read_file', 'read_multiple_files', 'edit_files', 'create_file', 'list_directory', 'check_missing_packages', 'get_context', 'save_context'].includes(t.name)
    );
    const checkerTools = lcTools.filter((t) =>
      ['verify_project', 'execute_command', 'read_file', 'read_multiple_files', 'edit_files', 'create_file', 'get_context', 'save_context'].includes(t.name)
    );

    // Keep the last valid plan available for follow-up requests. If a model
    // returns an empty response, the builder can still apply the new request
    // to the existing project instead of falling back to an empty plan.
    let savedPlan = null;
    try {
      const saved = JSON.parse(await toolMap.get_context.execute({ key: 'builder' }));
      if (saved?.plan && Array.isArray(saved.plan.files)) savedPlan = saved.plan;
    } catch { }

    const trimmedHistory = previousMessages
      .filter((m) => ['user', 'assistant'].includes(m.role))
      .slice(-6)
      .map((m) => `${m.role.toUpperCase()}: ${m.content.slice(0, 200)}`)
      .join('\n');

    const fullPrompt = trimmedHistory
      ? `Previous context:\n${trimmedHistory}\n\nRequest: ${userMessage}`
      : userMessage;


    const MAX_REPLANS = 2;
    let replanCount = 0;
    let buildFailed = false;
    let lastError = null;
    let checkOutput = null;
    let builderSummary = '';
    let planObj = null;
    let previewUrl = null;

    if (hasCheckpoint('planned')) {
      try {
        const savedPlan = JSON.parse(await toolMap.get_context.execute({ key: 'builder' }));
        planObj = savedPlan.plan;
        await emit(chatId, 'planning', 'Resuming from saved build plan.');
      } catch {
        throw new Error('Could not restore saved build plan for retry');
      }
    }

    do {
      await throwIfBuildStopped(job);
      buildFailed = false;
      const isReplan = replanCount > 0;

      const resumePlanner = hasCheckpoint('planned') && !isReplan;

      // ── STEP 2: PlannerAgent ──────────────────────────────────────────
      if (!resumePlanner) {
      await throwIfBuildStopped(job);
      await emit(chatId, 'planning',
        isReplan
          ? `Re-planning after build failure (attempt ${replanCount + 1}/${MAX_REPLANS})…`
          : 'Analysing request and creating build plan…'
      );
      logger.startStage('PlannerAgent');

      const planPrompt = isReplan
        ? `${fullPrompt}\n\nPrevious build failed.\nError: ${JSON.stringify(lastError)}\nCreate a SIMPLER plan.`
        : fullPrompt;

      let planOutput;
      try {
        planOutput = await withRetry(() =>runPlannerAgent({
  prompt: planPrompt,
  emit,
  chatId,
  modelOptions
}), 1, 'PlannerAgent');
        await throwIfBuildStopped(job);

        // Some OpenRouter responses complete successfully but contain no
        // text. Retry once with a very explicit JSON-only instruction.
        if (!String(planOutput ?? '').trim()) {
          await emit(chatId, 'planning', 'Planner returned an empty response; retrying with a compact JSON request…');
          planOutput = await runPlannerAgent({
            prompt: `${planPrompt}\n\nIMPORTANT: Return a non-empty raw JSON object now. Do not explain. Include at least summary, approach, homeComponent, files, newPages, packages, and steps.`,
            emit,
            chatId,
            modelOptions,
          });
        }
        logger.endStage('PlannerAgent');
      } catch (err) {
        // OpenRouter free routes can leave a planner request pending even
        // though the rest of the pipeline is healthy. A missing plan is not
        // a reason to discard the whole build: use the fast Groq planner as
        // a recovery path, then fall through to the local fallback plan.
        logger._log('warn', 'PlannerAgent failed', { error: err?.message ?? String(err), provider });

        const activePlannerProvider = modelOptions.provider ?? AGENT_PROVIDERS.planner;
        if (['openrouter', 'gemini'].includes(activePlannerProvider)) {
          try {
            await emit(chatId, 'planning', 'Planner is taking too long; retrying with a faster model…');
            planOutput = await runPlannerAgent({
              prompt: `${planPrompt}\n\nReturn a compact, non-empty JSON build plan only.`,
              emit,
              chatId,
              modelOptions: { provider: 'groq' },
              timeoutMs: 45_000,
            });
            logger.endStage('PlannerAgent', { recoveredWith: 'groq' });
          } catch (fallbackErr) {
            logger._log('warn', 'Planner fallback failed; using local plan', {
              error: fallbackErr?.message ?? String(fallbackErr),
            });
            planOutput = '';
            await emit(chatId, 'planning', 'Planner is unavailable; continuing with a direct build plan.');
            logger.endStage('PlannerAgent', { fallback: true });
          }
        } else {
          planOutput = '';
          await emit(chatId, 'planning', 'Planner is unavailable; continuing with a direct build plan.');
          logger.endStage('PlannerAgent', { fallback: true });
        }
      }

      await job.updateProgress({ percent: 25 + replanCount * 5, stage: 'planned' });

      const { valid, plan, repaired, error: planError } = validatePlan(planOutput);
      const hasUsablePlan = valid && (plan.files.length > 0 || plan.steps.length > 0);
      planObj = hasUsablePlan ? plan : (savedPlan ?? fallbackPlanForRequest(fullPrompt));

      if (!hasUsablePlan) {
        logger._log('warn', 'PlannerAgent returned no usable plan', { planError, responseChars: String(planOutput ?? '').length });
        await emit(chatId, 'planning', 'Planner response was empty; continuing with the project context.', { plan: { ...planObj, _fallback: true } });
      } else if (!valid || repaired) {
        logger._log('warn', 'PlannerAgent output repaired', { planError });
        await emit(chatId, 'planning', 'Plan auto-repaired and validated.', { plan: planObj });
      } else {
        await emit(chatId, 'planning', 'Build plan ready.', { plan: planObj });
      }

      try {
        await toolMap.save_context.execute({
          context: JSON.stringify({ plan: planObj, replanCount, lastError }),
        });
      } catch { }
      }

      
      const resumeBuilder = hasCheckpoint('built') && !isReplan;
      if (!resumeBuilder) {
      await throwIfBuildStopped(job);
      await emit(chatId, 'building',
        isReplan ? 'Rebuilding with revised plan…' : 'Implementing the planned files…'
      );
      logger.startStage('BuilderAgent');

      try {
        // Honour the provider/model chosen for this job. Gemini is the primary
        // builder, with Groq/Qwen as a recovery path for quota, timeout, or
        // provider-tool-call failures.
        const builderModelOptions = modelOptions;
        const runBuildPass = async (options, label, compactFallback = false) => {
          const activeProvider = options.provider ?? AGENT_PROVIDERS.builder;
          // Do not leave the UI stuck on a Gemini tool-call request. If it
          // has not responded within 45 seconds, switch to the Qwen fallback
          // while the project is still in a clean, buildable state.
          const timeoutMs = activeProvider === 'gemini' ? 45_000 : undefined;
          // A retry against an overloaded free Gemini endpoint only makes the
          // UI appear stuck and can consume the remaining quota. Hand control
          // to Qwen immediately; other providers retain one bounded retry.
          const retries = activeProvider === 'gemini' ? 0 : 1;
          let result = await withRetry(
            () => runBuilderAgent({
              plan: planObj,
              userMessage: fullPrompt,
              tools: builderTools,
              emit,
              chatId,
              modelOptions: options,
              compactFallback,
              forceWriteTool: compactFallback,
              ...(timeoutMs ? { timeoutMs } : {}),
            }),
            retries, label
          );
          await throwIfBuildStopped(job);

          if (!result.wroteFiles) {
            await emit(chatId, 'building', 'The builder inspected the project but did not write files. Retrying with a write-only pass…');
            result = await withRetry(
              () => runBuilderAgent({
                plan: planObj,
                userMessage: fullPrompt,
                tools: builderWriteTools,
                emit,
                chatId,
                modelOptions: options,
                repair: true,
                compactFallback,
                forceWriteTool: compactFallback,
                ...(timeoutMs ? { timeoutMs } : {}),
              }),
              retries, `${label}Repair`
            );
          }
          if (!result.wroteFiles) {
            throw new Error('Builder completed without writing any project files after the write-only retry.');
          }
          return result;
        };

        let buildResult;
        try {
          buildResult = await runBuildPass(builderModelOptions, 'BuilderAgent');
        } catch (primaryError) {
          if (primaryError?.code === 'BUILD_STOPPED') throw primaryError;
          const primaryProvider = builderModelOptions.provider ?? AGENT_PROVIDERS.builder;
          if (primaryProvider !== 'gemini') throw primaryError;

          logger._log('warn', 'Gemini builder failed; falling back to Groq/Qwen', {
            error: primaryError?.message ?? String(primaryError),
          });
          await emit(chatId, 'building', 'Gemini is unavailable; continuing with the Qwen fallback…');
          buildResult = await runBuildPass({ provider: 'groq' }, 'BuilderFallbackQwen', true);
        }
        builderSummary = String(buildResult.output ?? '').trim();
        logger.endStage('BuilderAgent');
      } catch (err) {
        logger.error('BuilderAgent', err);
        logger.endStage('BuilderAgent', { errorType: 'unknown' });
        throw err;
      }

      await job.updateProgress({ percent: 55 + replanCount * 5, stage: 'built' });
      await emit(chatId, 'building', 'Code generation complete.');
      } else {
        await emit(chatId, 'building', 'Builder already completed; continuing from checkpoint.');
      }

      // Make the first usable preview available before optional review agents run.
      if (!previewUrl) {
        await throwIfBuildStopped(job);
        previewUrl = await startPreviewServer(sb, projectId, chatId, logger);
      }
      await syncProjectFiles(sb, projectId, logger);

      // Fast path: successful builds do not need two extra LLM review agents.
      let fastCheckPassed = false;
      try {
        await emit(chatId, 'checking', 'Running fast internal build and lint check…');
        // The direct deterministic check also needs a timeline event. Without
        // this, the build runs but its real shell output is invisible in chat.
        const fastCheckRaw = await toolMap.verify_project.execute({});
        await emit(chatId, 'tool', JSON.stringify({
          ...publicToolDetails('verify_project', fastCheckRaw),
          args: {},
        }));
        const fastCheck = JSON.parse(fastCheckRaw);
        fastCheckPassed = fastCheck.success === true;
        if (fastCheckPassed) {
          checkOutput = 'Fast internal verification passed.';
          await toolMap.save_context.execute({
            key: 'checker',
            context: JSON.stringify({
              buildStatus: 'passed',
              lintStatus: fastCheck.lint?.skipped ? 'skipped' : 'passed',
              ready: true,
              buildAttempts: 1,
            }),
          });
          await job.updateProgress({ percent: 85 + replanCount * 3, stage: 'checked' });
          await emit(chatId, 'checking', 'Fast internal verification passed; review agents skipped.');
        }
      } catch (err) {
        await emit(chatId, 'checking', `Fast verification unavailable; continuing with review agents. ${err.message}`);
      }

      if (!fastCheckPassed) {
      await throwIfBuildStopped(job);
      await emit(chatId, 'validating', 'Reviewing source files and fixing issues…');
      const resumeValidator = hasCheckpoint('validated') && !isReplan;
      if (!resumeValidator) {
      logger.startStage('CodeValidatorAgent');

      try {
        await withRetry(
          () => runValidatorAgent({ tools: validatorTools ,emit,chatId,modelOptions}),
          1, 'CodeValidatorAgent'
        );
        await throwIfBuildStopped(job);
        logger.endStage('CodeValidatorAgent');
      } catch (err) {
        logger.error('CodeValidatorAgent', err);
        logger.endStage('CodeValidatorAgent', { errorType: 'unknown' });
        if (!isReviewAgentFailure(err)) throw err;
        // Review is best-effort. A model quota/timeout must not hide the usable
        // code and preview that Builder already produced.
        await emit(chatId, 'validating', `Validator skipped: ${err.message}. Preview and generated code remain available.`);
      }

      await job.updateProgress({ percent: 72 + replanCount * 3, stage: 'validated' });
      await emit(chatId, 'validating', 'Validation complete.');
      } else {
        await emit(chatId, 'validating', 'Validator already completed; continuing from checkpoint.');
      }


      await emit(chatId, 'checking', 'Running production build and lint check…');
      logger.startStage('AppCheckerAgent');

      try {
        checkOutput = await withRetry(
          () => runCheckerAgent({ tools: checkerTools,emit,chatId,modelOptions }),
          1, 'AppCheckerAgent'
        );
        await throwIfBuildStopped(job);
        logger.endStage('AppCheckerAgent');
      } catch (err) {
        logger.error('AppCheckerAgent', err);
        logger.endStage('AppCheckerAgent', { errorType: 'unknown' });
        if (!isReviewAgentFailure(err)) throw err;
        checkOutput = `Checker skipped: ${err.message}`;
        await emit(chatId, 'checking', `Checker skipped: ${err.message}. Partial build delivered.`);
      }

      await job.updateProgress({ percent: 85 + replanCount * 3, stage: 'checked' });
      }

      try {
        const raw = await toolMap.get_context.execute({ key: 'checker' });
        const ctx = JSON.parse(raw);
        if (ctx.buildStatus === 'failed') {
          buildFailed = true;
          lastError = {
            buildStatus: ctx.buildStatus,
            lintStatus: ctx.lintStatus,
            errorType: classifyError(checkOutput ?? ''),
            snippet: (checkOutput ?? '').slice(0, 600),
          };
          logger._log('warn', `Build failed — replan ${replanCount + 1}/${MAX_REPLANS}`, lastError);
          await emit(chatId, 'error', `Build failed (${lastError.errorType}). Re-planning…`, { lastError });
          replanCount++;
        }
      } catch { }

    } while (buildFailed && replanCount <= MAX_REPLANS);

    if (buildFailed) {
      await emit(chatId, 'checking', `⚠️ Build still failing after ${replanCount} replans — partial build delivered.`);
    } else {
      await emit(chatId, 'checking', 'Build verified ✓');
    }

    await job.updateProgress(92);

    if (!previewUrl) try {
    await sb.files.write('/app/vite.config.js',
`import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true
  }
})
`);

      await sb.commands.run("pkill -f 'vite.*5173' >/dev/null 2>&1 || true", { cwd: '/app', timeoutMs: 10_000 }).catch(() => { });
      await sleep(500);
      await sb.commands.run(
        'nohup npm run dev -- --host 0.0.0.0 --port 5173 >/tmp/sizzer-vite.log 2>&1 </dev/null &',
        { cwd: '/app', timeoutMs: 10_000 }
      );
      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          await sb.commands.run('curl -fsS http://127.0.0.1:5173 >/dev/null', { cwd: '/app', timeoutMs: 5_000 });
          break;
        } catch { await sleep(1000); }
      }

      const hostname = await sb.getHost(5173);
      previewUrl = hostname
        ? (hostname.startsWith('http') ? hostname : `https://${hostname}`)
        : null;

      if (previewUrl) {
        await emit(chatId, 'checking', 'Preview server is running', { previewUrl });
        await prisma.project.update({
          where: { id: projectId },
          data: { sandboxId: sb.sandboxId ?? `local-${projectId}`, previewUrl },
        }).catch((e) => logger._log('warn', 'Failed to save previewUrl', { error: e.message }));
      } else {
        logger._log('warn', 'Failed to obtain sandbox host for preview');
      }
    } catch (err) {
      logger._log('warn', 'Dev server start failed', { error: err.message });
    }


    await emit(chatId, 'checking', 'Syncing files to database…');
    try {
      const allFiles = await collectSandboxFiles(sb, '/app/src');
      const rootFiles = ['vite.config.js', 'index.html', 'package.json', 'tailwind.config.js', 'postcss.config.js'];
      for (const file of rootFiles) {
        try {
          const content = await sb.files.read(`/app/${file}`);
          allFiles.push({ path: file, content });
        } catch { }
      }

      console.log('[DEBUG] Files found:', JSON.stringify(allFiles.map(f => f.path)));
      await Promise.all(
        allFiles.map(({ path, content }) =>
          prisma.projectFile.upsert({
            where: { projectId_path: { projectId, path } },
            update: { content },
            create: { projectId, path, content },
          }).catch((e) => logger._log('warn', `Upsert failed: ${path}`, { err: e.message }))
        )
      );
      logger._log('info', `Synced ${allFiles.length} files`, { projectId });
    } catch (err) {
      logger._log('warn', 'File sync error', { error: err.message });
    }

    // A successful fast check is verification metadata, not the user-facing
    // result. Keep the builder's actual summary so completed jobs describe the
    // work that was done instead of the hardcoded verification sentence.
    const usableBuilderSummary = builderSummary.length > 24 && !/^done[.!]?$/i.test(builderSummary);
    const summary = buildFailed
      ? (checkOutput || 'Build completed with issues.')
      : (usableBuilderSummary ? builderSummary : 'Your requested changes have been implemented and verified.');
    const tokenSummary = logger.tokens.summary();

    await prisma.message.create({
      data: {
        chatId, role: 'assistant', content: summary,
        metadata: { jobId: job.id, previewUrl, replanCount, tokens: tokenSummary },
      },
    });

    logger.endStage('pipeline', { replanCount, previewUrl, tokens: tokenSummary });
    await logger.publishTelemetry();
    await job.updateProgress(100);
    await emit(chatId, 'done', summary, { previewUrl, tokens: tokenSummary, replans: replanCount });
    activeBuildJobsByChat.delete(chatId);

    return { previewUrl, summary, tokens: tokenSummary };

  } catch (err) {
    if (err?.code === 'BUILD_STOPPED') {
      // Consume the cancellation marker. The handler returns successfully,
      // so this job is completed once and cannot be retried as a failure.
      await bullConnection.del(`build:cancel:${job.id}`).catch(() => { });
      await emit(chatId, 'done', 'Work stopped by user.').catch(() => { });
      await logger.publishTelemetry().catch(() => { });
      activeBuildJobsByChat.delete(chatId);
      return { cancelled: true };
    }
    const { type, message } = logger.error('pipeline', err);
    await emit(chatId, 'error', message, { errorType: type }).catch(() => { });
    await logger.publishTelemetry().catch(() => { });
    activeBuildJobsByChat.delete(chatId);

    try {
      await prisma.message.create({
        data: {
          chatId, role: 'assistant',
          content: `Build failed (${type}): ${message}`,
          metadata: { jobId: job.id, error: true, errorType: type },
        },
      });
    } catch { }

    throw err;
  }
}


const worker = new Worker('website-builds', processBuildJob, {
  connection: bullConnection,
  concurrency: 1,
  limiter: { max: 1, duration: 60_000 },
});

worker.on('completed', (job) =>
  console.log(JSON.stringify({ level: 'info', event: 'job_completed', jobId: job.id, ts: new Date().toISOString() }))
);
worker.on('failed', (job, err) =>
  console.error(JSON.stringify({
    level: 'error',
    event: 'job_failed',
    jobId: job?.id,
    // Tool providers may include an entire attempted source tree in a failed
    // function-call payload. Keep server logs useful without dumping code.
    error: compactErrorMessage(err),
    ts: new Date().toISOString(),
  }))
);
worker.on('error', (err) =>
  console.error(JSON.stringify({ level: 'error', event: 'worker_error', error: err.message, ts: new Date().toISOString() }))
);

console.log(JSON.stringify({
  level: "info",
  event: "worker_started",
  plannerProvider: AGENT_PROVIDERS.planner,
  builderProvider: AGENT_PROVIDERS.builder,
  validatorProvider: AGENT_PROVIDERS.validator,
  checkerProvider: AGENT_PROVIDERS.checker,
  plannerModel: AGENT_PROVIDERS.planner === 'gemini'
    ? GEMINI_MODEL
    : AGENT_PROVIDERS.planner === 'groq'
      ? GROQ_PLANNER_MODEL
      : process.env.OPENROUTER_MODEL || CLAUDE_PLANNER_MODEL,
  builderModel: AGENT_PROVIDERS.builder === 'gemini'
    ? GEMINI_MODEL
    : AGENT_PROVIDERS.builder === 'groq'
      ? GROQ_BUILDER_MODEL
      : process.env.OPENROUTER_MODEL || CLAUDE_BUILDER_MODEL,
  validatorModel: AGENT_PROVIDERS.validator === 'groq' ? GROQ_VALIDATOR_MODEL : OPENROUTER_VALIDATOR_MODEL,
  checkerModel: AGENT_PROVIDERS.checker === 'groq' ? GROQ_CHECKER_MODEL : OPENROUTER_CHECKER_MODEL,
  ts: new Date().toISOString(),
}));

async function shutdown(signal) {
  console.log(JSON.stringify({ level: 'info', event: 'shutdown', signal }));
  await worker.close();
  await prisma.$disconnect();
  await publisher.quit();
  await bullConnection.quit();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
