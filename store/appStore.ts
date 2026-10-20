import { create } from "zustand";
import type { Project, Message, PipelineEvent, CenterTab, ProjectFile } from "@/types";

interface AppState {
  // Active selections
  activeProject: Project | null;
  activeChatId: string | null;
  activeTab: CenterTab;
  previewUrl: string | null;
  selectedFile: ProjectFile | null;

  // Build state
  isBuilding: boolean;
  buildProgress: number;
  pipelineEvents: PipelineEvent[];

  // Actions
  setActiveProject: (project: Project | null) => void;
  setActiveChatId: (chatId: string | null) => void;
  setActiveTab: (tab: CenterTab) => void;
  setPreviewUrl: (url: string | null) => void;
  setSelectedFile: (file: ProjectFile | null) => void;
  setIsBuilding: (v: boolean) => void;
  setBuildProgress: (p: number) => void;
  addPipelineEvent: (event: PipelineEvent) => void;
  setPipelineEvents: (events: PipelineEvent[]) => void;
  clearPipelineEvents: () => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeProject: null,
  activeChatId: null,
  activeTab: "preview",
  previewUrl: null,
  selectedFile: null,
  isBuilding: false,
  buildProgress: 0,
  pipelineEvents: [],

  setActiveProject:   (p)  => set({ activeProject: p, activeChatId: null, previewUrl: p?.previewUrl ?? null, pipelineEvents: [], selectedFile: null }),
  setActiveChatId:    (id) => set({ activeChatId: id }),
  setActiveTab:       (t)  => set({ activeTab: t }),
  setPreviewUrl:      (u)  => set({ previewUrl: u }),
  setSelectedFile:    (f)  => set({ selectedFile: f }),
  setIsBuilding:      (v)  => set({ isBuilding: v }),
  setBuildProgress:   (p)  => set({ buildProgress: p }),
  addPipelineEvent:   (e)  => set((s) => ({ pipelineEvents: [...s.pipelineEvents, e] })),
  setPipelineEvents:  (events) => set({ pipelineEvents: events }),
  clearPipelineEvents: ()  => set({ pipelineEvents: [] }),
  reset: () => set({
    activeProject: null, activeChatId: null, activeTab: "preview",
    previewUrl: null, selectedFile: null, isBuilding: false,
    buildProgress: 0, pipelineEvents: [],
  }),
}));
