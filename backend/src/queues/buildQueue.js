import { Queue, QueueEvents } from 'bullmq';
import { bullConnection } from '../redis/index.js';

export const buildQueue = new Queue('website-builds', {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail:    { count: 200 },
  },
});

export const buildQueueEvents = new QueueEvents('website-builds', {
  connection: bullConnection,
});
