import 'dotenv/config';
import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const makeClient = (name) => {
  const client = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,   
    enableReadyCheck: false,
    lazyConnect: false,
  });
  client.on('connect',  () => console.log(`[Redis:${name}] connected`));
  client.on('error',    (e) => console.error(`[Redis:${name}] error:`, e.message));
  client.on('close',    () => console.warn(`[Redis:${name}] connection closed`));
  return client;
};


export const bullConnection = makeClient('bull');

export const publisher = makeClient('pub');


export const subscriber = makeClient('sub');


export const buildChannel = (chatId) => `build:${chatId}`;






