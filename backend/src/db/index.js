// Prisma Client is CommonJS in this installed Prisma release. Default import
// keeps the ESM backend compatible with Node's CommonJS interop.
import PrismaClientPackage from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const { PrismaClient } = PrismaClientPackage;

const isDev = process.env.NODE_ENV !== 'production';
const logQueries = process.env.PRISMA_LOG_QUERIES === 'true';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

globalThis.__prisma ??= new PrismaClient({
  adapter,
  // Query logs are extremely noisy during pipeline event persistence. Keep
  // warnings/errors by default; enable individual SQL logs only when needed.
  log: isDev && logQueries ? ['query', 'warn', 'error'] : ['warn', 'error'],
});

export default globalThis.__prisma;






