import { buildQueue } from '../queues/buildQueue.js';
import { bullConnection } from '../redis/index.js';
import { randomUUID } from 'node:crypto';

export async function enqueueBuildJob({ chatId, projectId, userId, userMessage, previousMessages = [], provider, model }) {
  // BullMQ's auto-incrementing IDs can be reused after a local Redis reset.
  // A stale `build:cancel:<id>` key would then instantly cancel an unrelated
  // new build, so make every build identifier globally unique.
  const jobId = `build-${randomUUID()}`;
  await bullConnection.del(`build:cancel:${jobId}`);
  const job = await buildQueue.add(
    'build',
    { chatId, projectId, userId, userMessage, previousMessages, provider, model },
    { jobId },
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

// Waiting jobs can be removed immediately. Active jobs receive a cancellation
// flag which the worker checks between pipeline stages, avoiding a half-finished
// follow-up stage after the user presses Stop.
export async function cancelBuildJob(jobId) {
  const job = await buildQueue.getJob(jobId);
  if (!job) return { jobId, state: 'not_found' };

  const state = await job.getState();
  if (['waiting', 'delayed', 'prioritized'].includes(state)) {
    await job.remove();
    return { jobId, state: 'cancelled' };
  }

  if (state === 'active') {
    await bullConnection.set(`build:cancel:${jobId}`, '1', 'EX', 3600);
    await job.discard();
    return { jobId, state: 'cancelling' };
  }

  return { jobId, state };
}
