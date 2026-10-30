"use client";
import { useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { chatApi } from "@/lib/api";
import { ForgeWebSocket } from "@/lib/websocket";
import { useAppStore } from "@/store/appStore";
import { useAuthStore } from "@/store/authStore";
import type { Message, PipelineEvent } from "@/types";

const STAGE_PROGRESS: Record<string, number> = {
  start: 5, model: 8, sandbox: 20, planning: 35,
  building: 60, validating: 80, checking: 92,
  preview: 95, done: 100,
};

export function useChat(chatId: string | null) {
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const {
    setIsBuilding, setBuildProgress, addPipelineEvent, clearPipelineEvents,
    setPipelineEvents, setPreviewUrl, setActiveChatId, setActiveJobId,
    activeJobId, activeProject, isBuilding,
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
  const messagesQuery = useQuery<Message[]>({
    queryKey: ["messages", resolvedChatId],
    queryFn: () => chatApi.messages(resolvedChatId!),
    enabled: !!resolvedChatId,
  });

  // Restore thoughts, tool calls, and file changes for reopened projects.
  const pipelineEventsQuery = useQuery<PipelineEvent[]>({
    queryKey: ["pipeline-events", resolvedChatId],
    queryFn: () => chatApi.pipelineEvents(resolvedChatId!),
    enabled: !!resolvedChatId,
    // WebSocket remains the fast path. This makes Docker/backend restarts or
    // a missed Redis frame recover visibly instead of leaving the timeline on
    // "Build models selected" while the worker is still progressing.
    refetchInterval: isBuilding ? 3_000 : false,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!pipelineEventsQuery.data) return;
    setPipelineEvents(pipelineEventsQuery.data);
    const latest = pipelineEventsQuery.data.at(-1);
    if (latest?.type === "pipeline_update" && ["done", "error"].includes(latest.stage ?? "")) {
      setIsBuilding(false);
      setActiveJobId(null);
    }
  }, [pipelineEventsQuery.data, setActiveJobId, setIsBuilding, setPipelineEvents]);

  // Hot reloads, a backend restart, or a dropped WebSocket can leave a build
  // spinner in the Zustand store after BullMQ has already removed the job.
  // Verify the recorded job once so the composer cannot remain locked at 0%.
  useEffect(() => {
    if (!isBuilding) return;
    let cancelled = false;

    const clearStaleBuild = () => {
      if (cancelled) return;
      activeJobIdRef.current = null;
      setActiveJobId(null);
      setIsBuilding(false);
      setBuildProgress(0);
    };

    if (!activeJobId) {
      clearStaleBuild();
      return () => { cancelled = true; };
    }

    const checkJob = () => {
      chatApi.jobStatus(activeJobId)
        .then(({ state }) => {
          if (!['active', 'waiting', 'delayed', 'prioritized', 'waiting-children'].includes(state)) {
            clearStaleBuild();
          }
        })
        .catch(clearStaleBuild);
    };
    checkJob();
    const interval = window.setInterval(checkJob, 5_000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [activeJobId, isBuilding, setActiveJobId, setBuildProgress, setIsBuilding]);

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

        // BullMQ may retry a failed run in the background. Treat every new
        // non-terminal pipeline stage as active and restore the job id so the
        // visible Stop build control remains usable after that retry starts.
        if (event.stage !== "done" && event.stage !== "error") {
          setIsBuilding(true);
          if (event.jobId) {
            activeJobIdRef.current = event.jobId;
            setActiveJobId(event.jobId);
          }
        }

        const progress = STAGE_PROGRESS[event.stage];
        if (progress !== undefined) setBuildProgress(progress);

        // recording the preview url whenever it's included
        if (event.previewUrl) {
          setPreviewUrl(event.previewUrl);
        }

        // File writes are persisted by the worker as soon as their tool call
        // completes. Refresh the code/file queries immediately instead of
        // making the user wait for the final preview and full project sync.
        if (event.stage === "tool" && activeProject?.id) {
          qc.invalidateQueries({ queryKey: ["project-files", activeProject.id] });
          qc.invalidateQueries({ queryKey: ["file-content", activeProject.id] });
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
  }, [resolvedChatId, token, activeProject?.id, qc]);

  // Send message
  const sendMutation = useMutation({
    mutationFn: (message: string) =>
      chatApi.send(activeProject!.id, message),
    // The terminal is a live run view, not the complete chat history. Without
    // this reset, a follow-up displayed the first build's planner card below
    // its own activity and made it look as if planning had run again.
    onMutate: () => {
      clearPipelineEvents();
    },
    onSuccess: async (data) => {
      activeJobIdRef.current = data.jobId;
      setActiveJobId(data.jobId);
      setActiveChatId(data.chatId);
      setIsBuilding(true);
      setBuildProgress(0);
      // The API has already persisted the prompt, so show it straight away
      // while the worker waits for a sandbox or model response.
      await qc.invalidateQueries({ queryKey: ["messages", data.chatId] });
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
    // A page refresh/reconnect can leave the client showing an old build even
    // after BullMQ has already removed its job.  Never leave the composer
    // locked in that stale state.
    if (!jobId) {
      setIsBuilding(false);
      setBuildProgress(0);
      return true;
    }

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
