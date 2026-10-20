-- AlterTable
ALTER TABLE "Chat" ADD COLUMN "pipelineEvents" JSONB NOT NULL DEFAULT '[]';
