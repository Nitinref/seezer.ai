// src/types/index.ts

export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  creditBalanceUsd: number;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  sandboxId: string | null;
  previewUrl: string | null;  // ← ADD THIS
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}
export interface ProjectFile {
  id: string;
  projectId: string;
  path: string;
  content?: string;
  updatedAt: string;
}

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface Message {
  id: string;
  chatId: string;
  role: MessageRole;
  content: string;
  metadata: {
    jobId?: string;
    previewUrl?: string;
    error?: boolean;
    errorType?: string;
    tokens?: TokenSummary;
    replans?: number;
  };
  createdAt: string;
}

export type PipelineStage =
  | "start"
  | "model"
  | "sandbox"
  | "planning"
  | "agent"
  | "building"
  | "validating"
  | "checking"
  | "preview"
  | "planner"
  | "builder"
  | "validator"
  | "checker"
  | "tool"
  | "done"
  | "error";

export interface PipelineEvent {
  type: "pipeline_update" | "telemetry" | "connected" | "pong";
  jobId?: string;
  stage?: PipelineStage;
  message?: string;
  ts: number;
  plan?: unknown;
  previewUrl?: string;
  tokens?: TokenSummary;
  replans?: number;
  stages?: StageRecord[];
  audit?: AuditSummary;
}

export interface AgentTokens {
  input: number;
  output: number;
  cost_usd: number;
  calls: number;
}

export interface TokenSummary {
  agents: Record<string, AgentTokens>;
  total: { input: number; output: number; cost_usd: number };
}

export interface StageRecord {
  stage: string;
  durationMs: number;
  tokens?: AgentTokens;
}

export interface AuditSummary {
  totalCalls: number;
  byTool: Record<string, number>;
}

export type JobState = "waiting" | "active" | "completed" | "failed" | "delayed" | "not_found";

export interface JobStatus {
  jobId: string;
  state: JobState;
  progress: number;
  data: unknown | null;
}

export interface ChatResponse {
  chatId: string;
  jobId: string;
  status: "queued";
}

export type CenterTab = "preview" | "code";

export interface HintChip {
  label: string;
  prompt: string;
}
