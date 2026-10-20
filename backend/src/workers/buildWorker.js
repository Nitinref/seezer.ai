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
  AGENT_PROVIDERS
} from '../utils/llm.js';
import prisma from '../db/index.js';


import { runPlannerAgent } from '../agents/plannerAgent.js';
import { runBuilderAgent } from '../agents/builderAgent.js';
import { runValidatorAgent } from '../agents/validatorAgent.js';
import { runCheckerAgent } from '../agents/checkerAgent.js';


const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fallbackHomeForRequest(userMessage = '') {
  const train = /train|railway|rail|ticket|journey/i.test(userMessage);
  if (train) return `import React from 'react';

const routes = [
  { from: 'New Delhi', to: 'Mumbai Central', time: '16h 20m', price: '₹1,299' },
  { from: 'Bengaluru', to: 'Chennai Central', time: '5h 10m', price: '₹699' },
  { from: 'Kolkata', to: 'Varanasi', time: '9h 45m', price: '₹899' },
];

export default function Home() {
  return <main className="min-h-screen bg-slate-950 text-white">
    <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
      <div className="flex items-center gap-2 text-xl font-bold"><span className="rounded-lg bg-orange-500 px-2 py-1">R</span> Railly</div>
      <div className="hidden gap-8 text-sm text-slate-300 md:flex"><a href="#search">Search trains</a><a href="#routes">Popular routes</a><a href="#offers">Offers</a></div>
      <button className="rounded-full border border-slate-700 px-4 py-2 text-sm">Sign in</button>
    </nav>
    <section id="search" className="mx-auto max-w-6xl px-6 pb-16 pt-14">
      <div className="max-w-3xl"><p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-orange-400">Travel smarter</p><h1 className="text-5xl font-black leading-tight md:text-7xl">Every journey starts with a better ticket.</h1><p className="mt-6 max-w-xl text-lg text-slate-400">Find comfortable trains, compare fares, and book your next journey in seconds.</p></div>
      <div className="mt-12 rounded-3xl bg-white p-3 text-slate-900 shadow-2xl shadow-orange-950/30 md:p-5"><div className="grid gap-3 md:grid-cols-[1fr_1fr_180px_auto] md:items-end"><label className="rounded-2xl bg-slate-100 p-4 text-xs text-slate-500">FROM<input className="mt-2 block w-full bg-transparent text-base font-semibold outline-none" placeholder="Departure station" /></label><label className="rounded-2xl bg-slate-100 p-4 text-xs text-slate-500">TO<input className="mt-2 block w-full bg-transparent text-base font-semibold outline-none" placeholder="Arrival station" /></label><label className="rounded-2xl bg-slate-100 p-4 text-xs text-slate-500">DATE<input className="mt-2 block w-full bg-transparent text-base font-semibold outline-none" type="date" /></label><button className="rounded-2xl bg-orange-500 px-7 py-4 font-bold text-white hover:bg-orange-600">Search trains</button></div></div>
    </section>
    <section id="routes" className="mx-auto max-w-6xl px-6 pb-20"><div className="mb-6 flex items-end justify-between"><div><p className="text-sm text-orange-400">Popular journeys</p><h2 className="mt-2 text-3xl font-bold">Go further for less</h2></div><a href="#search" className="text-sm text-slate-400">View all routes →</a></div><div className="grid gap-4 md:grid-cols-3">{routes.map((route) => <article key={route.from} className="rounded-3xl border border-slate-800 bg-slate-900 p-5"><div className="mb-8 flex items-center justify-between text-sm text-slate-400"><span>Direct route</span><span>●</span></div><h3 className="text-lg font-semibold">{route.from}</h3><div className="my-2 text-orange-400">↓</div><h3 className="text-lg font-semibold">{route.to}</h3><div className="mt-6 flex justify-between border-t border-slate-800 pt-4 text-sm text-slate-400"><span>{route.time}</span><b className="text-white">from {route.price}</b></div></article>)}</div></section>
  </main>;`;
  return `export default function Home() { return <main className="min-h-screen bg-slate-950 p-12 text-white"><h1 className="text-5xl font-bold">${userMessage.replace(/[$`\\]/g, '').slice(0, 80)}</h1><p className="mt-4 text-slate-400">Your new experience starts here.</p></main>; }`;
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
      const isTransient = msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('rate_limit_exceeded') || msg.includes('overloaded') || msg.includes('fetch failed') || msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT');

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
  const event = { type: 'pipeline_update', stage, message, ts: Date.now(), ...extra };
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

async function scaffoldReactApp(sb, chatId) {
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

  await emit(chatId, 'tool', JSON.stringify({
    version: 1,
    kind: 'write_multiple_files',
    ok: true,
    files: [
      '/app/package.json', '/app/vite.config.js', '/app/index.html', '/app/src/main.jsx',
      '/app/tailwind.config.js', '/app/postcss.config.js', '/app/src/index.css',
      '/app/src/App.jsx', '/app/src/pages/Home.jsx',
    ],
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

function toLangChainTools(sandboxTools, emit, chatId) {
  return sandboxTools.map((t) =>
    new DynamicStructuredTool({
      name: t.name,
      description: t.description,
      schema: t.parameters,
      func: async (args) => {
        try {
          const result = await t.execute(args);
          if (result === undefined || result === null) return '(no output)';
          const str = typeof result === 'string' ? result : JSON.stringify(result);
          await emit(chatId, 'tool', JSON.stringify({
            ...publicToolDetails(t.name, str),
            args: publicToolArgs(args),
          }));
          return str.trim() === '' ? '(empty output)' : str;
        } catch (err) {
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
      await emit(chatId, 'preview', 'Preview is ready while background checks continue.', { previewUrl });
      await prisma.project.update({
        where: { id: projectId },
        data: { sandboxId: sb.sandboxId ?? `local-${projectId}`, previewUrl },
      }).catch((e) => logger._log('warn', 'Failed to save previewUrl', { error: e.message }));
    }
    return previewUrl;
  } catch (err) {
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
  const modelOptions = provider === 'openrouter' ? { provider, model } : {};
  const previousProgress = job.progress && typeof job.progress === 'object' ? job.progress : {};
  const resumeStage = previousProgress.stage || null;
  const isRetryResume = job.attemptsMade > 0 && Boolean(resumeStage);
  const stageRank = { planned: 1, built: 2, validated: 3, checked: 4 };
  const hasCheckpoint = (stage) => isRetryResume && (stageRank[resumeStage] || 0) >= stageRank[stage];
  const logger = new PipelineLogger(chatId, job.id);
  logger.startStage('pipeline');

  try {
    await emit(chatId, 'start', 'Build job received — pipeline starting…');
    logger._log('info', 'Pipeline started', { projectId, msg: userMessage.slice(0, 80) });

    if (job.attemptsMade > 0 && !isRetryResume) await sleep(15_000);

    await prisma.message.create({
      data: { chatId, role: 'user', content: userMessage, metadata: { jobId: job.id } },
    });

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
      await scaffoldReactApp(sb, chatId);
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
    const lcTools = toLangChainTools(sandboxTools, emit, chatId);
    const toolMap = Object.fromEntries(sandboxTools.map((t) => [t.name, t]));

    // Keep Builder focused on reading and writing the app. Shell/build/browser
    // checks consume free-model steps and are handled by the Checker.
    const builderTools = lcTools.filter((t) =>
      ['read_file', 'read_multiple_files', 'edit_files', 'create_file', 'write_multiple_files', 'delete_file', 'list_directory', 'get_context', 'save_context'].includes(t.name)
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
      buildFailed = false;
      const isReplan = replanCount > 0;

      const resumePlanner = hasCheckpoint('planned') && !isReplan;

      // ── STEP 2: PlannerAgent ──────────────────────────────────────────
      if (!resumePlanner) {
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
        logger.error('PlannerAgent', err);
        logger.endStage('PlannerAgent', { errorType: 'unknown' });
        throw err;
      }

      await job.updateProgress({ percent: 25 + replanCount * 5, stage: 'planned' });

      const { valid, plan, repaired, error: planError } = validatePlan(planOutput);
      const hasUsablePlan = valid && (plan.files.length > 0 || plan.steps.length > 0);
      planObj = hasUsablePlan ? plan : (savedPlan ?? fallbackPlanForRequest(fullPrompt));

      if (!hasUsablePlan) {
        logger._log('warn', 'PlannerAgent returned no usable plan', { planError, responseChars: String(planOutput ?? '').length });
        await emit(chatId, 'planning', 'Planner response was empty; continuing with the project context.', { plan: planObj });
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
      await emit(chatId, 'building',
        isReplan ? 'Rebuilding with revised plan…' : 'Writing code and assembling components…'
      );
      logger.startStage('BuilderAgent');

      try {
        await withRetry(
          () => runBuilderAgent({ plan: planObj, userMessage: fullPrompt, tools: builderTools ,emit,chatId,modelOptions}),
          1, 'BuilderAgent'
        );

        // A model can return a normal-looking completion without making a
        // tool call. Never mark that as a successful build while the scaffold
        // placeholder is still the homepage; give it one focused write turn.
        const homeAfterBuild = await sb.files.read('/app/src/pages/Home.jsx');
        if (homeAfterBuild.includes('Ready to build')) {
          await emit(chatId, 'building', 'Builder returned without writing the homepage; retrying focused file generation…');
          await withRetry(
            // Keep the configured Builder provider/model for repair. Forcing
            // the validator's Groq model can hit a small output quota before
            // it gets a chance to call a file-writing tool.
            () => runBuilderAgent({
              plan: planObj,
              userMessage: fullPrompt,
              tools: builderWriteTools,
              emit,
              chatId,
              modelOptions,
              repair: true,
            }),
            0, 'BuilderRepair'
          );
          const repairedHome = await sb.files.read('/app/src/pages/Home.jsx');
          if (repairedHome.includes('Ready to build')) {
            await sb.files.write('/app/src/pages/Home.jsx', fallbackHomeForRequest(userMessage));
            await emit(chatId, 'building', 'Generated a local starter homepage while the AI write step was unavailable.');
          }
        }
        logger.endStage('BuilderAgent');
      } catch (err) {
        if (String(err?.message ?? '').includes('BuilderRepair')) {
          await sb.files.write('/app/src/pages/Home.jsx', fallbackHomeForRequest(userMessage));
          await emit(chatId, 'building', 'Generated a local starter homepage while the AI write step was unavailable.');
          logger.endStage('BuilderAgent', { fallback: true });
        } else {
        logger.error('BuilderAgent', err);
        logger.endStage('BuilderAgent', { errorType: 'unknown' });
        throw err;
        }
      }

      await job.updateProgress({ percent: 55 + replanCount * 5, stage: 'built' });
      await emit(chatId, 'building', 'Code generation complete.');
      } else {
        await emit(chatId, 'building', 'Builder already completed; continuing from checkpoint.');
      }

      // Make the first usable preview available before optional review agents run.
      if (!previewUrl) {
        previewUrl = await startPreviewServer(sb, projectId, chatId, logger);
      }
      await syncProjectFiles(sb, projectId, logger);

      // Fast path: successful builds do not need two extra LLM review agents.
      let fastCheckPassed = false;
      try {
        await emit(chatId, 'checking', 'Running fast internal build and lint check…');
        const fastCheck = JSON.parse(await toolMap.verify_project.execute({}));
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
      await emit(chatId, 'validating', 'Reviewing source files and fixing issues…');
      const resumeValidator = hasCheckpoint('validated') && !isReplan;
      if (!resumeValidator) {
      logger.startStage('CodeValidatorAgent');

      try {
        await withRetry(
          () => runValidatorAgent({ tools: validatorTools ,emit,chatId,modelOptions}),
          1, 'CodeValidatorAgent'
        );
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

    const summary = checkOutput || 'Build pipeline completed.';
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

    return { previewUrl, summary, tokens: tokenSummary };

  } catch (err) {
    const { type, message } = logger.error('pipeline', err);
    await emit(chatId, 'error', message, { errorType: type }).catch(() => { });
    await logger.publishTelemetry().catch(() => { });

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
  console.error(JSON.stringify({ level: 'error', event: 'job_failed', jobId: job?.id, error: err.message, ts: new Date().toISOString() }))
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
  plannerModel: process.env.OPENROUTER_MODEL || CLAUDE_PLANNER_MODEL,
  builderModel: process.env.OPENROUTER_MODEL || CLAUDE_BUILDER_MODEL,
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
