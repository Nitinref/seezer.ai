import 'dotenv/config';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';

import { createBullBoard }  from '@bull-board/api';
import { BullMQAdapter }   from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter }   from '@bull-board/express';

import { buildQueue }   from './queues/buildQueue.js';
import { attachWebSocket } from './ws/handler.js';
import authRouter   from './routes/auth.js';
import chatRouter    from './routes/chats.js';
import projectRouter      from './routes/projects.js';
import './workers/buildWorker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.PORT  || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// ── Express app ─────────────────────────────────────────────────────────────
const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Bull Board ───────────────────────────────────────────────────────────────
const boardAdapter = new ExpressAdapter();
boardAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues:  [new BullMQAdapter(buildQueue)],
  serverAdapter: boardAdapter,
});

app.use('/admin/queues', boardAdapter.getRouter());


// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    const counts = await buildQueue.getJobCounts();
    return res.json({ status: 'ok', ts: new Date().toISOString(), queue: counts });
  } catch (err) {
    return res.status(500).json({ status: 'error', error: err.message });
  }
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/auth',     authRouter);
app.use('/chat',     chatRouter);      // POST /chat   (note: Express router mounts at prefix)
app.use('/chats',    chatRouter);      // GET  /chats/:id/messages  etc.
app.use('/projects', projectRouter);

// ── 404 fallback for API routes ───────────────────────────────────────────────
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

app.get('/', (_req, res) => {
  res.json({
    status: "Seezer backend running 🚀"
  });
});
// ── HTTP server ───────────────────────────────────────────────────────────────
const server = http.createServer(app);

// ── WebSocket server (attaches to HTTP upgrade events) ───────────────────────
attachWebSocket(server);

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, HOST, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║           FORGE — AI Website Builder         ║
╠══════════════════════════════════════════════╣
║  HTTP   → http://${HOST}:${PORT}             
║  WS     → ws://${HOST}:${PORT}/ws/:chatId    
║  Admin  → http://${HOST}:${PORT}/admin/queues
╚══════════════════════════════════════════════╝
`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`\n[Server] ${signal} — shutting down…`);
  server.close(async () => {
    const { default: prisma } = await import('./db/index.js');
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException',  (err) => console.error('[Server] Uncaught:', err));
process.on('unhandledRejection', (err) => console.error('[Server] Unhandled:', err));

export default app;