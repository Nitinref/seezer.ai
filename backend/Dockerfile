FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts

ENV DATABASE_URL=postgresql://build:build@localhost:5432/build

RUN pnpm install --frozen-lockfile \
    --network-concurrency=1 \
    --fetch-retries=5 \
    --fetch-retry-mintimeout=10000 \
    --fetch-retry-maxtimeout=120000

COPY src ./src

EXPOSE 3001

CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm start"]