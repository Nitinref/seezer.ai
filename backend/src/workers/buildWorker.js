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
  OPENROUTER_CHECKER_MODEL
} from '../utils/llm.js';
import prisma from '../db/index.js';


import { runPlannerAgent } from '../agents/plannerAgent.js';
import { runBuilderAgent } from '../agents/builderAgent.js';
import { runValidatorAgent } from '../agents/validatorAgent.js';
import { runCheckerAgent } from '../agents/checkerAgent.js';


const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, maxRetries = 2, label = '') {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err?.message ?? String(err);
      const is429 = msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('rate_limit_exceeded') || msg.includes('overloaded');

      if (is429 && attempt < maxRetries) {
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

async function emit(chatId, stage, message, extra = {}) {
  const payload = JSON.stringify({ type: 'pipeline_update', stage, message, ts: Date.now(), ...extra });
  await publisher.publish(buildChannel(chatId), payload);
}

async function scaffoldReactApp(sb, chatId) {
  await emit(chatId, 'sandbox', 'Scaffolding React + Tailwind + React Icons…');

  if (!sb?.files) throw new Error(`Sandbox files API not available. Keys: ${Object.keys(sb ?? {}).join(', ')}`);

  try {
    await sb.commands.run('mkdir -p /app/src/pages', { cwd: '/', timeoutMs: 30_000 });
  } catch (err) {
    console.warn(`[Scaffold] mkdir warning: ${err.message}`);
  }

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

  await sb.files.write('/app/src/index.css', '@import "tailwindcss";\n');

  await sb.files.write('/app/src/App.jsx',
    "import { BrowserRouter, Routes, Route } from 'react-router-dom';\nimport Home from './pages/Home';\nfunction App() { return <BrowserRouter><Routes><Route path=\"/\" element={<Home />} /></Routes></BrowserRouter>; }\nexport default App;\n");

  await sb.files.write('/app/src/pages/Home.jsx',
    'export default function Home() { return <div className="min-h-screen flex items-center justify-center bg-gray-50"><h1 className="text-2xl font-bold text-gray-800">Ready to build…</h1></div>; }\n');

  await emit(chatId, 'sandbox', 'Installing dependencies…');
  await sb.commands.run('npm install', { cwd: '/app', timeoutMs: 180_000 });
  await emit(chatId, 'sandbox', 'Scaffold complete.');
}

function toLangChainTools(sandboxTools) {
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

async function processBuildJob(job) {
  const { chatId, projectId, userMessage, previousMessages } = job.data;
  const logger = new PipelineLogger(chatId, job.id);
  logger.startStage('pipeline');

  try {
    await emit(chatId, 'start', 'Build job received — pipeline starting…');
    logger._log('info', 'Pipeline started', { projectId, msg: userMessage.slice(0, 80) });

    if (job.attemptsMade > 0) await sleep(15_000);

    await prisma.message.create({
      data: { chatId, role: 'user', content: userMessage, metadata: { jobId: job.id } },
    });

    logger.startStage('sandbox');
    await emit(chatId, 'sandbox', 'Initialising cloud sandbox…');

    const sb = await getOrCreateSandbox(projectId);

    let needsScaffold = false;
    try { await sb.files.read('/app/package.json'); } catch { needsScaffold = true; }

    if (needsScaffold) {
      await scaffoldReactApp(sb, chatId);
    } else {
     await emit(chatId, 'sandbox', 'Existing sandbox reused.')

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
    const lcTools = toLangChainTools(sandboxTools);
    const toolMap = Object.fromEntries(sandboxTools.map((t) => [t.name, t]));

    const builderTools = lcTools;
    const validatorTools = lcTools.filter((t) =>
      ['read_file', 'create_file', 'list_directory', 'check_missing_packages', 'save_context'].includes(t.name)
    );
    const checkerTools = lcTools.filter((t) =>
      ['test_build', 'execute_command', 'read_file', 'create_file', 'save_context'].includes(t.name)
    );

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

    do {
      buildFailed = false;
      const isReplan = replanCount > 0;

      // ── STEP 2: PlannerAgent ──────────────────────────────────────────
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
  chatId
}), 2, 'PlannerAgent');
        logger.endStage('PlannerAgent');
      } catch (err) {
        logger.error('PlannerAgent', err);
        logger.endStage('PlannerAgent', { errorType: 'unknown' });
        throw err;
      }

      await job.updateProgress(25 + replanCount * 5);

      const { valid, plan, repaired, error: planError } = validatePlan(planOutput);
      planObj = plan;

      if (!valid || repaired) {
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

      
      await emit(chatId, 'building',
        isReplan ? 'Rebuilding with revised plan…' : 'Writing code and assembling components…'
      );
      logger.startStage('BuilderAgent');

      try {
        await withRetry(
          () => runBuilderAgent({ plan: planObj, userMessage, tools: builderTools ,emit,chatId}),
          2, 'BuilderAgent'
        );
        logger.endStage('BuilderAgent');
      } catch (err) {
        logger.error('BuilderAgent', err);
        logger.endStage('BuilderAgent', { errorType: 'unknown' });
        throw err;
      }

      await job.updateProgress(55 + replanCount * 5);
      await emit(chatId, 'building', 'Code generation complete.');

      await emit(chatId, 'validating', 'Reviewing source files and fixing issues…');
      logger.startStage('CodeValidatorAgent');

      try {
        await withRetry(
          () => runValidatorAgent({ tools: validatorTools ,emit,chatId}),
          2, 'CodeValidatorAgent'
        );
        logger.endStage('CodeValidatorAgent');
      } catch (err) {
        logger.error('CodeValidatorAgent', err);
        logger.endStage('CodeValidatorAgent', { errorType: 'unknown' });
        throw err;
      }

      await job.updateProgress(72 + replanCount * 3);
      await emit(chatId, 'validating', 'Validation complete.');


      await emit(chatId, 'checking', 'Running production build and lint check…');
      logger.startStage('AppCheckerAgent');

      try {
        checkOutput = await withRetry(
          () => runCheckerAgent({ tools: checkerTools,emit,chatId }),
          2, 'AppCheckerAgent'
        );
        logger.endStage('AppCheckerAgent');
      } catch (err) {
        logger.error('AppCheckerAgent', err);
        logger.endStage('AppCheckerAgent', { errorType: 'unknown' });
        throw err;
      }

      await job.updateProgress(85 + replanCount * 3);

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

    let previewUrl = null;
    try {
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


      sb.commands.run('npm run dev -- --host 0.0.0.0 --port 5173', {
        cwd: '/app', background: true,
      }).catch(() => { });

      await new Promise((r) => setTimeout(r, 5000));

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
  plannerModel: CLAUDE_PLANNER_MODEL,
  builderModel: CLAUDE_BUILDER_MODEL,
  validatorModel: OPENROUTER_VALIDATOR_MODEL,
  checkerModel: OPENROUTER_CHECKER_MODEL,
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
