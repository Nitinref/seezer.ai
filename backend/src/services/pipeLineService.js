import { buildQueue } from '../queues/buildQueue.js';

export async function enqueueBuildJob({ chatId, projectId, userMessage, previousMessages = [] }) {
  const job = await buildQueue.add(
    'build',
    { chatId, projectId, userMessage, previousMessages },
  );
  return { jobId: job.id };
}

export async function getJobStatus(jobId) {
  const job = await buildQueue.getJob(jobId);
  if (!job) return { jobId, state: 'not_found', progress: 0, data: null };

  const state = await job.getState();
  return {
    jobId,
    state,
    progress: job.progress ?? 0,
    data: job.returnvalue ?? null,
  };
}
