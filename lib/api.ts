import axios, { AxiosError } from "axios";
import type {
  AuthResponse, Project, ProjectFile, Message,
  ChatResponse, JobStatus, PipelineEvent,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("forge_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("forge_token");
      localStorage.removeItem("forge_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<AuthResponse>("/auth/login", { email, password }).then((r) => r.data),

  signup: (email: string, password: string, name?: string) =>
    apiClient.post<AuthResponse>("/auth/signup", { email, password, name }).then((r) => r.data),

  me: () =>
    apiClient.get<{ user: AuthResponse["user"] }>("/auth/me").then((r) => r.data.user),
};

export const projectsApi = {
  list: () =>
    apiClient.get<{ projects: Project[] }>("/projects").then((r) => r.data.projects),

  get: (id: string) =>
    apiClient.get<{ project: Project }>(`/projects/${id}`).then((r) => r.data.project),

  create: (name: string, description?: string) =>
    apiClient.post<{ project: Project }>("/projects", { name, description }).then((r) => r.data.project),

  delete: (id: string) =>
    apiClient.delete(`/projects/${id}`),

  files: (id: string) =>
    apiClient.get<{ files: ProjectFile[] }>(`/projects/${id}/files`).then((r) => r.data.files),

  fileContent: (id: string, path: string) =>
    apiClient.get<{ file: ProjectFile }>(`/projects/${id}/files/${path}`).then((r) => r.data.file),

  restorePreview: (id: string) =>
    apiClient.post<{ previewUrl: string }>(`/projects/${id}/restore-preview`).then((r) => r.data),
};


export const chatApi = {
  latestForProject: (projectId: string) =>
    apiClient.get<{ chat: { id: string } | null }>(`/chats/project/${projectId}`).then((r) => r.data.chat),
  send: (projectId: string, message: string) => {
    const provider = typeof window !== "undefined" ? localStorage.getItem("forge_ai_provider") || undefined : undefined;
    const model = typeof window !== "undefined" ? localStorage.getItem("forge_ai_model") || undefined : undefined;
    return apiClient.post<ChatResponse>("/chat", { projectId, message, provider, model }).then((r) => r.data);
  },

  messages: (chatId: string) =>
    apiClient.get<{ messages: Message[] }>(`/chats/${chatId}/messages`).then((r) => r.data.messages),

  pipelineEvents: (chatId: string) =>
    apiClient.get<{ events: PipelineEvent[] }>(`/chats/${chatId}/events`).then((r) => r.data.events),

  jobStatus: (jobId: string) =>
    apiClient.get<JobStatus>(`/chats/jobs/${jobId}`).then((r) => r.data),

  cancel: (jobId: string) =>
    apiClient.post<{ jobId: string; state: string }>(`/chats/jobs/${jobId}/cancel`).then((r) => r.data),
};
