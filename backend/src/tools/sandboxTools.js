import { Sandbox } from 'e2b';
import { z } from 'zod';
import prisma from '../db/index.js';

// ── Sandbox registry: projectId → Sandbox instance ────────────────────────
const sandboxRegistry = new Map();
const SANDBOX_CONNECT_TIMEOUT_MS = Number(process.env.SANDBOX_CONNECT_TIMEOUT_MS || 75_000);

async function withinSandboxTimeout(operation, label) {
  let timer;
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Sandbox ${label} timed out after ${Math.round(SANDBOX_CONNECT_TIMEOUT_MS / 1000)}s`)),
          SANDBOX_CONNECT_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Return an existing sandbox (if alive) or create a new one.
 */
export async function getOrCreateSandbox(projectId) {
  const existing = sandboxRegistry.get(projectId);
  if (existing) {
    try {
      await existing.files.list('/');
      return existing;
    } catch {
      sandboxRegistry.delete(projectId);
    }
  }

  // The registry is process-local. Reconnect to the sandbox saved on the
  // project after a worker/backend restart instead of silently creating a
  // fresh empty workspace for the next follow-up message.
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { sandboxId: true },
  });
  if (project?.sandboxId && !project.sandboxId.startsWith('local-')) {
    try {
      const restored = await withinSandboxTimeout(Sandbox.connect(project.sandboxId, {
        apiKey: process.env.E2B_API_KEY,
      }), 'reconnection');
      await restored.files.list('/');
      sandboxRegistry.set(projectId, restored);
      console.log(`[Sandbox] Reconnected to saved sandbox for project ${projectId}: ${project.sandboxId}`);
      return restored;
    } catch (error) {
      console.warn(`[Sandbox] Saved sandbox unavailable for ${projectId}; creating a replacement: ${error.message}`);
    }
  }

  const sb = await withinSandboxTimeout(Sandbox.create(process.env.E2B_TEMPLATE_ID || 'base', {
    apiKey: process.env.E2B_API_KEY,
    timeoutMs: 10 * 60 * 1000,
  }), 'creation');

  sandboxRegistry.set(projectId, sb);
  await prisma.project.update({
    where: { id: projectId },
    data: { sandboxId: sb.sandboxId },
  }).catch((error) => console.warn(`[Sandbox] Could not save sandbox id: ${error.message}`));

  // If the old sandbox expired, rebuild its workspace from the files already
  // synced to the database before the builder starts the follow-up request.
  try {
    const savedFiles = await prisma.projectFile.findMany({
      where: { projectId },
      select: { path: true, content: true },
    });
    if (savedFiles.length) {
      await Promise.all(savedFiles
        .filter((file) => file.content != null)
        .map((file) => sb.files.write(
          file.path.startsWith('/') ? file.path : `/app/${file.path}`,
          file.content,
        )));
      console.log(`[Sandbox] Restored ${savedFiles.length} saved files for project ${projectId}`);
    }
  } catch (error) {
    console.warn(`[Sandbox] Could not restore saved files: ${error.message}`);
  }
  console.log(`[Sandbox] Created new sandbox for project ${projectId}: ${sb.sandboxId}`);
  return sb;
}

/**
 * Kill and remove sandbox for a project.
 */
export async function killSandbox(projectId) {
  const sb = sandboxRegistry.get(projectId);
  if (sb) {
    try { await sb.kill(); } catch {}
    sandboxRegistry.delete(projectId);
    console.log(`[Sandbox] Killed sandbox for project ${projectId}`);
  }
}

/**
 * Rehydrate a project's sandbox and restart its preview server when a saved
 * preview URL has expired. E2B sandboxes are ephemeral, so a stored hostname
 * alone is not enough to make an old project previewable after reopening it.
 */
export async function restoreProjectPreview(projectId) {
  const sb = await getOrCreateSandbox(projectId);
  try {
    console.log(`[Preview] Restoring preview for project ${projectId} in sandbox ${sb.sandboxId}`);
    const install = await sb.commands.run('npm install --no-audit --no-fund', { cwd: '/app', timeoutMs: 120_000 });
    if (install.exitCode !== 0) {
      throw new Error(`Dependency install failed: ${String(install.stderr || install.stdout).slice(-500)}`);
    }
    console.log(`[Preview] Dependencies installed for project ${projectId}`);
    await sb.commands.run("pkill -f 'vite.*5173' >/dev/null 2>&1 || true", { cwd: '/app', timeoutMs: 10_000 }).catch(() => {});
    await sb.commands.run('nohup npm run dev -- --host 0.0.0.0 --port 5173 >/tmp/sizzer-vite.log 2>&1 </dev/null &', { cwd: '/app', timeoutMs: 10_000 });

    for (let attempt = 0; attempt < 12; attempt++) {
      try {
        await sb.commands.run('curl -fsS http://127.0.0.1:5173 >/dev/null', { cwd: '/app', timeoutMs: 5_000 });
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
    }

    const hostname = await sb.getHost(5173);
    const previewUrl = hostname ? (hostname.startsWith('http') ? hostname : `https://${hostname}`) : null;
    if (!previewUrl) throw new Error('Preview server did not expose a public URL');

    await prisma.project.update({
      where: { id: projectId },
      data: { sandboxId: sb.sandboxId ?? `local-${projectId}`, previewUrl },
    });
    console.log(`[Preview] Ready for project ${projectId}: ${previewUrl}`);
    return previewUrl;
  } catch (error) {
    console.error(`[Preview] Restore failed for project ${projectId}: ${error.message}`);
    throw new Error(`Could not restore preview: ${error.message}`);
  }
}

/** Ensure path is absolute under /app */
function abs(p) {
  if (!p) return '/app';
  if (p.startsWith('/')) return p;
  return `/app/${p}`;
}

function capText(value, max = 12_000) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max)}\n…[truncated]` : text;
}

function lineDiff(before, after) {
  const oldLines = String(before ?? '').split('\n');
  const newLines = String(after ?? '').split('\n');
  const removed = oldLines.filter((line, index) => line !== newLines[index]).map((line) => `-${line}`);
  const added = newLines.filter((line, index) => line !== oldLines[index]).map((line) => `+${line}`);
  return { diff: [...removed, ...added].join('\n').slice(0, 20_000), additions: added.length, deletions: removed.length };
}

// ── Tool factory ────────────────────────────────────────────────────────────
// Returns plain objects { name, description, parameters, execute }
// Compatible with buildWorker.js toLangChainTools()

export function makeSandboxTools(projectId) {
  const getSb = () => getOrCreateSandbox(projectId);

  return [

    // 1. create_file
    {
      name: 'create_file',
      description: 'Create or overwrite a file with the given content.',
      parameters: z.object({
        path:    z.string().describe('File path (relative to /app or absolute)'),
        content: z.string().describe('File content'),
      }),
      execute: async ({ path, content }) => {
        const sb = await getSb();
        const p  = abs(path);
        let before = '';
        try { before = await sb.files.read(p); } catch {}
        await sb.files.write(p, content);
        const stats = lineDiff(before, content);
        return JSON.stringify({ success: true, path: p, additions: stats.additions, deletions: stats.deletions, _diffs: `--- ${p}\n${stats.diff}` });
      },
    },

    // 2. read_file
    {
      name: 'read_file',
      description: 'Read and return the content of a file.',
      parameters: z.object({
        path: z.string().describe('File path'),
      }),
      execute: async ({ path }) => {
        const sb      = await getSb();
        const p       = abs(path);
        const content = await sb.files.read(p);
        return JSON.stringify({ path: p, content: capText(content) });
      },
    },

    // Read a group of files in one sandbox round-trip.
    {
      name: 'read_multiple_files',
      description: 'Read several project files in one call. Prefer this over repeated read_file calls.',
      parameters: z.object({
        paths: z.array(z.string()).min(1).max(12).describe('File paths to read'),
      }),
      execute: async ({ paths }) => {
        const sb = await getSb();
        const files = await Promise.all(paths.slice(0, 12).map(async (path) => {
          const p = abs(path);
          try {
            return { path: p, content: capText(await sb.files.read(p)), exists: true };
          } catch (error) {
            return { path: p, content: '', exists: false, error: error?.message ?? 'File not found' };
          }
        }));
        return capText(JSON.stringify({ files }), 32_000);
      },
    },

    // Apply exact in-place edits without sending/re-writing complete files.
    {
      name: 'edit_files',
      description: 'Apply multiple exact text replacements across files in one call. Prefer this for small edits; every old_string must match exactly once unless replace_all is true. Nothing is written if any edit fails.',
      parameters: z.object({
        edits: z.array(z.object({
          path: z.string(),
          old_string: z.string().min(1),
          new_string: z.string(),
          replace_all: z.boolean().optional().default(false),
        })).min(1).max(20),
      }),
      execute: async ({ edits }) => {
        const sb = await getSb();
        const originals = new Map();
        const updated = new Map();

        for (const edit of edits) {
          const p = abs(edit.path);
          if (!originals.has(p)) {
            originals.set(p, await sb.files.read(p));
            updated.set(p, originals.get(p));
          }

          const current = updated.get(p);
          const matches = current.split(edit.old_string).length - 1;
          if (matches === 0) throw new Error(`edit_files: old_string not found in ${p}`);
          if (!edit.replace_all && matches !== 1) {
            throw new Error(`edit_files: old_string matched ${matches} times in ${p}; add context or set replace_all`);
          }
          updated.set(p, edit.replace_all
            ? current.split(edit.old_string).join(edit.new_string)
            : current.replace(edit.old_string, edit.new_string));
        }

        await Promise.all([...updated.entries()].map(([path, content]) => sb.files.write(path, content)));
        const diffs = [...updated.entries()].map(([path, content]) => ({ path, ...lineDiff(originals.get(path), content) }));
        return JSON.stringify({
          ok: true,
          changed_files: [...updated.keys()],
          edits: edits.length,
          additions: diffs.reduce((sum, item) => sum + item.additions, 0),
          deletions: diffs.reduce((sum, item) => sum + item.deletions, 0),
          _diffs: diffs.map((item) => `--- ${item.path}\n${item.diff}`).join('\n').slice(0, 20_000),
        });
      },
    },

    // 3. write_multiple_files
    {
      name: 'write_multiple_files',
      description: 'Write several files in one call.',
      parameters: z.object({
        files: z.array(z.object({
          path:    z.string(),
          content: z.string(),
        })).describe('Array of { path, content }'),
      }),
      execute: async ({ files }) => {
        const sb      = await getSb();
        const results = [];
        for (const { path, content } of files) {
          const p = abs(path);
          let before = '';
          try { before = await sb.files.read(p); } catch {}
          await sb.files.write(p, content);
          const stats = lineDiff(before, content);
          results.push({ path: p, success: true, additions: stats.additions, deletions: stats.deletions });
        }
        return JSON.stringify({ results, additions: results.reduce((sum, item) => sum + item.additions, 0), deletions: results.reduce((sum, item) => sum + item.deletions, 0) });
      },
    },

    // 4. delete_file
    {
      name: 'delete_file',
      description: 'Delete a file from the sandbox.',
      parameters: z.object({
        path: z.string().describe('File path to delete'),
      }),
      execute: async ({ path }) => {
        const sb = await getSb();
        const p  = abs(path);
        await sb.files.remove(p);
        return JSON.stringify({ success: true, path: p });
      },
    },

    // 5. list_directory
    {
      name: 'list_directory',
      description: 'List entries in a directory.',
      parameters: z.object({
        path: z.string().default('/app').describe('Directory path'),
      }),
      execute: async ({ path }) => {
        const sb      = await getSb();
        const p       = abs(path);
        const entries = await sb.files.list(p);
        return JSON.stringify({ path: p, entries });
      },
    },

    // 6. execute_command
    {
      name: 'execute_command',
      description: 'Run a shell command and return stdout/stderr/exitCode.',
      parameters: z.object({
        cmd:       z.string().describe('Shell command'),
        cwd:       z.string().default('/app').describe('Working directory'),
        timeoutMs: z.number().default(60_000).describe('Timeout in ms'),
      }),
      execute: async ({ cmd, cwd, timeoutMs }) => {
        const sb     = await getSb();
        const result = await sb.commands.run(cmd, {
          cwd: abs(cwd),
          timeoutMs,
        });
        return JSON.stringify({
          stdout:   result.stdout,
          stderr:   result.stderr,
          exitCode: result.exitCode,
        });
      },
    },

    // 7. test_build
    {
      name: 'test_build',
      description: 'Run `npm run build` in /app and return the result.',
      parameters: z.object({}),
      execute: async () => {
        const sb     = await getSb();
        const result = await sb.commands.run('npm run build', {
          cwd:       '/app',
          timeoutMs: 120_000,
        });
        return JSON.stringify({
          success:  result.exitCode === 0,
          stdout:   result.stdout,
          stderr:   result.stderr,
          exitCode: result.exitCode,
        });
      },
    },

    // Deterministic build + lint check; avoids separate test_build/command loops.
    {
      name: 'verify_project',
      description: 'Run the production build and, only if it passes, run the project lint script if present.',
      parameters: z.object({}),
      execute: async () => {
        const sb = await getSb();
        let build;
        try {
          build = await sb.commands.run('npm run build', { cwd: '/app', timeoutMs: 120_000 });
        } catch (error) {
          // E2B can throw (rather than return a non-zero result) when its
          // command runner cannot start. Return a normal failed verification
          // so a preview request gives a useful response instead of crashing
          // the entire BullMQ job.
          return JSON.stringify({
            success: false,
            // The E2B command client can throw on a non-zero process instead
            // of returning its result. Preserve compiler stdout/stderr so the
            // repair builder receives the file, line, and parse error rather
            // than the useless generic "exit status 1" message.
            build: {
              exitCode: error?.exitCode ?? error?.code ?? null,
              stdout: error?.stdout ?? error?.result?.stdout ?? '',
              stderr: error?.stderr ?? error?.result?.stderr ?? '',
              error: error?.message ?? String(error),
            },
            lint: { skipped: true, exitCode: null, stdout: '', stderr: '' },
          });
        }
        let lint = { skipped: true, exitCode: 0, stdout: '', stderr: '' };
        if (build.exitCode === 0) {
          const result = await sb.commands.run('npm run lint --if-present', { cwd: '/app', timeoutMs: 120_000 });
          lint = { skipped: false, exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr };
        }
        return JSON.stringify({
          success: build.exitCode === 0 && lint.exitCode === 0,
          build: { exitCode: build.exitCode, stdout: build.stdout, stderr: build.stderr },
          lint,
        });
      },
    },

    // 8. check_missing_packages
    {
      name: 'check_missing_packages',
      description: 'Install one or more npm packages in /app.',
      parameters: z.object({
        packages: z.array(z.string()).describe('Package names to install'),
      }),
      execute: async ({ packages }) => {
        if (!packages.length) return JSON.stringify({ success: true, installed: [] });
        const sb     = await getSb();
        const result = await sb.commands.run(`npm install ${packages.join(' ')}`, {
          cwd:       '/app',
          timeoutMs: 120_000,
        });
        return JSON.stringify({
          success:   result.exitCode === 0,
          installed: packages,
          stdout:    result.stdout,
          stderr:    result.stderr,
        });
      },
    },

    // 9. get_context
  {
  name: 'get_context',
  description: 'Read saved context. Use key="builder", "validator", or "checker".',
  parameters: z.object({
    key: z.string().default('builder'),
  }),
  execute: async ({ key = 'builder' }) => {
    const sb = await getSb();
    try {
      return await sb.files.read(`/app/.build-context-${key}.json`);
    } catch {
      // A previous direct worker call omitted key before defaults were applied
      // by the LangChain schema. Keep that context recoverable once.
      if (key === 'builder') {
        try { return await sb.files.read('/app/.build-context-undefined.json'); } catch { }
      }
      try { return await sb.files.read('/app/.build-context.json'); } catch {
        return JSON.stringify({});
      }
    }
  },
},
    // 10. save_context
  {
  name: 'save_context',
  description: 'Persist build context. Use key="builder", "validator", or "checker" to avoid overwrites.',
  parameters: z.object({
    context: z.string().describe('JSON string of the context object to save'),
    key: z.string().default('builder'),
  }),
  execute: async ({ context, key = 'builder' }) => {
    const sb   = await getSb();
    const file = `/app/.build-context-${key}.json`;
    const data = typeof context === 'string' ? context : JSON.stringify(context, null, 2);
    await sb.files.write(file, data);
    return JSON.stringify({ success: true, file });
  },
},

  ];
}
