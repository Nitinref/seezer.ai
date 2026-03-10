import axios, { AxiosError } from "axios";
import type {
  AuthResponse, Project, ProjectFile, Message,
  ChatResponse, JobStatus,
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
};


export const chatApi = {
  send: (projectId: string, message: string) =>
    apiClient.post<ChatResponse>("/chat", { projectId, message }).then((r) => r.data),

  messages: (chatId: string) =>
    apiClient.get<{ messages: Message[] }>(`/chats/${chatId}/messages`).then((r) => r.data.messages),

  jobStatus: (jobId: string) =>
    apiClient.get<JobStatus>(`/chats/jobs/${jobId}`).then((r) => r.data),
};
