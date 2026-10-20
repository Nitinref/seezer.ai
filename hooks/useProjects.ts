"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import toast from "react-hot-toast";
import { chatApi, projectsApi } from "@/lib/api";
import { useAppStore } from "@/store/appStore";

export function useProjects() {
  const qc = useQueryClient();
  const setActiveProject = useAppStore((s) => s.setActiveProject);
  const activeProject = useAppStore((s) => s.activeProject);
  const setActiveChatId = useAppStore((s) => s.setActiveChatId);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });

  const latestChatQuery = useQuery({
    queryKey: ["project-chat", activeProject?.id],
    queryFn: () => chatApi.latestForProject(activeProject!.id),
    enabled: !!activeProject?.id,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!activeProject?.id) return;
    setActiveChatId(latestChatQuery.data?.id ?? null);
  }, [activeProject?.id, latestChatQuery.data?.id, setActiveChatId]);

  const createMutation = useMutation({
    mutationFn: ({ name, description }: { name: string; description?: string }) =>
      projectsApi.create(name, description),
    onSuccess: (project: any) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setActiveProject(project);
      toast.success(`Project "${project.name}" created`);
    },
    onError: () => toast.error("Could not create project"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setActiveProject(null);
      toast.success("Project deleted");
    },
    onError: () => toast.error("Could not delete project"),
  });

  return { projects, isLoading, createMutation, deleteMutation };
}

export function useProjectFiles(projectId: string | null) {
  return useQuery({
    queryKey: ["project-files", projectId],
    queryFn: () => projectsApi.files(projectId!),
    enabled: !!projectId,
    refetchInterval: false,
  });
}

export function useFileContent(projectId: string | null, filePath: string | null) {
  return useQuery({
    queryKey: ["file-content", projectId, filePath],
    queryFn: () => projectsApi.fileContent(projectId!, filePath!),
    enabled: !!projectId && !!filePath,
  });
}
