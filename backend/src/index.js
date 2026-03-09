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


const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://seezer-ai.vercel.app"
    ],
    credentials: true
  })
);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));


const boardAdapter = new ExpressAdapter();
boardAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues:  [new BullMQAdapter(buildQueue)],
  serverAdapter: boardAdapter,
});

app.use('/admin/queues', boardAdapter.getRouter());



app.get('/health', async (_req, res) => {
  try {
    const counts = await buildQueue.getJobCounts();
    return res.json({ status: 'ok', ts: new Date().toISOString(), queue: counts });
  } catch (err) {
    return res.status(500).json({ status: 'error', error: err.message });
  }
});


app.use('/auth',     authRouter);
app.use('/chat',     chatRouter);    
app.use('/chats',    chatRouter);      
app.use('/projects', projectRouter);


app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

app.get('/', (_req, res) => {
  res.json({
    status: "Seezer backend running 🚀"
  });
});

const server = http.createServer(app);

attachWebSocket(server);


server.listen(PORT, HOST, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║           SEEZER — AI Website Builder        ║
╠══════════════════════════════════════════════╣
║  HTTP   → http://${HOST}:${PORT}             
║  WS     → ws://${HOST}:${PORT}/ws/:chatId    
║  Admin  → http://${HOST}:${PORT}/admin/queues
╚══════════════════════════════════════════════╝
`);
});

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
