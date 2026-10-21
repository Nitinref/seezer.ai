"use client";
import { useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { chatApi } from "@/lib/api";
import { ForgeWebSocket } from "@/lib/websocket";
import { useAppStore } from "@/store/appStore";
import { useAuthStore } from "@/store/authStore";
import type { PipelineEvent } from "@/types";

const STAGE_PROGRESS: Record<string, number> = {
  start: 5, sandbox: 20, planning: 35,
  building: 60, validating: 80, checking: 92,
  preview: 95, done: 100,
};

export function useChat(chatId: string | null) {
  const token = useAuthStore((s) => s.token);
  const {
    setIsBuilding, setBuildProgress, addPipelineEvent,
    setPipelineEvents, setPreviewUrl, setActiveChatId, setActiveJobId, activeJobId, activeProject,
  } = useAppStore();
  const wsRef = useRef<ForgeWebSocket | null>(null);
  const activeJobIdRef = useRef<string | null>(null);

  const latestChatQuery = useQuery({
    queryKey: ["project-chat", activeProject?.id],
    queryFn: () => chatApi.latestForProject(activeProject!.id),
    enabled: !chatId && !!activeProject?.id,
  });
  const resolvedChatId = chatId ?? latestChatQuery.data?.id ?? null;

  useEffect(() => {
    if (resolvedChatId && resolvedChatId !== chatId) setActiveChatId(resolvedChatId);
  }, [resolvedChatId, chatId, setActiveChatId]);

  // Load existing messages
  const messagesQuery = useQuery({
    queryKey: ["messages", resolvedChatId],
    queryFn: () => chatApi.messages(resolvedChatId!),
    enabled: !!resolvedChatId,
  });

  // Restore thoughts, tool calls, and file changes for reopened projects.
  const pipelineEventsQuery = useQuery({
    queryKey: ["pipeline-events", resolvedChatId],
    queryFn: () => chatApi.pipelineEvents(resolvedChatId!),
    enabled: !!resolvedChatId,
  });

  useEffect(() => {
    if (pipelineEventsQuery.data) setPipelineEvents(pipelineEventsQuery.data);
  }, [pipelineEventsQuery.data, setPipelineEvents]);

  // Connect WebSocket when chatId changes
  useEffect(() => {
    if (!resolvedChatId || !token) return;
    wsRef.current?.disconnect();

    const ws = new ForgeWebSocket(resolvedChatId, token);

    ws.on((event: PipelineEvent) => {
      if (event.type === "connected" || event.type === "pong") return;

      // Telemetry is emitted after the assistant's final response is saved.
      // Clear the active state here as well as on `done`, so follow-up chat is
      // never held hostage by a late/missed final pipeline frame.
      if (event.type === "telemetry") {
        setIsBuilding(false);
        setActiveJobId(null);
        return;
      }

      if (event.type === "pipeline_update" && event.stage) {
        addPipelineEvent(event);

        const progress = STAGE_PROGRESS[event.stage];
        if (progress !== undefined) setBuildProgress(progress);

        // recording the preview url whenever it's included
        if (event.previewUrl) {
          setPreviewUrl(event.previewUrl);
        }

        if (event.stage === "done") {
          setIsBuilding(false);
          setActiveJobId(null);
        }
        if (event.stage === "error") {
          setIsBuilding(false);
          setActiveJobId(null);
          toast.error(`Build error: ${event.message?.slice(0, 60)}`);
        }
      }
    });

    ws.connect();
    wsRef.current = ws;

    return () => {
      ws.disconnect();
      wsRef.current = null;
    };
  }, [resolvedChatId, token]);

  // Send message
  const sendMutation = useMutation({
    mutationFn: (message: string) =>
      chatApi.send(activeProject!.id, message),
    onSuccess: (data) => {
      activeJobIdRef.current = data.jobId;
      setActiveJobId(data.jobId);
      setActiveChatId(data.chatId);
      setIsBuilding(true);
      setBuildProgress(0);
      // Reconnect WS to new chatId if it changed
      if (data.chatId !== resolvedChatId) {
        setActiveChatId(data.chatId);
      }
    },
    onError: () => {
      setIsBuilding(false);
      toast.error("Failed to send message");
    },
  });

  const disconnect = useCallback(() => {
    wsRef.current?.disconnect();
  }, []);

  const stopBuild = useCallback(async () => {
    const jobId = activeJobId ?? activeJobIdRef.current;
    if (!jobId) return false;

    // Make the stop control feel immediate; the server call then cancels the
    // queued or active worker safely in the background.
    setIsBuilding(false);
    setBuildProgress(0);
    activeJobIdRef.current = null;
    setActiveJobId(null);
    try {
      await chatApi.cancel(jobId);
      toast.success("Work stopped");
      return true;
    } catch (error) {
      toast.error("Could not stop the server job");
      throw error;
    }
  }, [activeJobId, setActiveJobId, setBuildProgress, setIsBuilding]);

  return { messagesQuery, sendMutation, stopBuild, disconnect, chatId: resolvedChatId, wsConnected: wsRef.current?.connected ?? false };
}
