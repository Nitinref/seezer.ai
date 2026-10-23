ALTER TABLE "User"
ADD COLUMN "creditBalanceUsd" DECIMAL(12,6) NOT NULL DEFAULT 2;

CREATE TABLE "CreditTransaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "jobId" TEXT,
  "agent" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "amountUsd" DECIMAL(12,6) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CreditTransaction"
ADD CONSTRAINT "CreditTransaction_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "CreditTransaction_userId_createdAt_idx"
ON "CreditTransaction"("userId", "createdAt" DESC);

CREATE INDEX "CreditTransaction_jobId_idx" ON "CreditTransaction"("jobId");
