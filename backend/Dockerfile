FROM node:20-bookworm-slim

WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN pnpm install --frozen-lockfile
COPY src ./src

EXPOSE 3001
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm start"]
