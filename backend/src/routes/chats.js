import { Router } from 'express';
import prisma from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { enqueueBuildJob, getJobStatus, cancelBuildJob } from '../services/pipeLineService.js';
import { buildQueue } from '../queues/buildQueue.js';

const router = Router();

// POST /chat — create/reuse chat, enqueue build job
router.post('/', authenticate, async (req, res) => {
  try {
    const { projectId, message, provider, model } = req.body;
    if (!projectId || !message) {
      return res.status(400).json({ error: 'projectId and message are required' });
    }

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.user.id },
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const account = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { creditBalanceUsd: true },
    });
    if (!account || Number(account.creditBalanceUsd) <= 0) {
      return res.status(402).json({ error: 'Your $2 AI credit has been used. Add credits to continue.' });
    }

    // Find most recent chat or create a new one
    let chat = await prisma.chat.findFirst({
      where: { projectId, userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!chat) {
      chat = await prisma.chat.create({
        data: { projectId, userId: req.user.id },
      });
    }

    // Fetch last 20 user/assistant messages for context
    const previousMessages = await prisma.message.findMany({
      where: {
        chatId: chat.id,
        role: { in: ['user', 'assistant'] },
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: { role: true, content: true },
    });

    const { jobId } = await enqueueBuildJob({
      chatId: chat.id,
      projectId,
      userId: req.user.id,
      userMessage: message,
      previousMessages,
      provider,
      model,
    });

    // Persist the prompt before returning.  The worker may still be queued
    // while E2B starts a sandbox, but the chat must show what the user asked
    // for immediately instead of looking empty during that wait.
    await prisma.message.create({
      data: { chatId: chat.id, role: 'user', content: message, metadata: { jobId } },
    });

    return res.status(202).json({ chatId: chat.id, jobId, status: 'queued' });
  } catch (err) {
    console.error('[chat/post]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /chats/jobs/:jobId — poll job status
router.get('/jobs/:jobId', authenticate, async (req, res) => {
  try {
    const status = await getJobStatus(req.params.jobId);
    return res.json(status);
  } catch (err) {
    console.error('[chat/job-status]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /chats/jobs/:jobId/cancel — stop a queued or in-progress build.
router.post('/jobs/:jobId/cancel', authenticate, async (req, res) => {
  try {
    const job = await buildQueue.getJob(req.params.jobId);
    const ownedProjectId = job?.data?.projectId;
    if (!ownedProjectId) return res.status(404).json({ error: 'Build job not found' });

    const project = await prisma.project.findFirst({
      where: { id: ownedProjectId, userId: req.user.id },
      select: { id: true },
    });
    if (!project) return res.status(404).json({ error: 'Build job not found' });

    return res.json(await cancelBuildJob(req.params.jobId));
  } catch (err) {
    console.error('[chat/cancel]', err);
    return res.status(500).json({ error: 'Unable to stop build' });
  }
});

// Restore the most recent chat when a project is reopened.
router.get('/project/:projectId', authenticate, async (req, res) => {
  try {
    const chat = await prisma.chat.findFirst({
      where: { projectId: req.params.projectId, userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, projectId: true, createdAt: true },
    });
    return res.json({ chat });
  } catch (err) {
    console.error('[chat/project]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Restore the persisted activity timeline when an existing chat is reopened.
router.get('/:id/events', authenticate, async (req, res) => {
  try {
    const chat = await prisma.chat.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      select: { pipelineEvents: true },
    });
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    return res.json({ events: Array.isArray(chat.pipelineEvents) ? chat.pipelineEvents : [] });
  } catch (err) {
    console.error('[chat/events]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /chats/:id/messages
router.get('/:id/messages', authenticate, async (req, res) => {
  try {
    const chat = await prisma.chat.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    const messages = await prisma.message.findMany({
      where: { chatId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });
    return res.json({ messages });
  } catch (err) {
    console.error('[chat/messages]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
