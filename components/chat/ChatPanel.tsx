"use client";
import React, { useRef, useEffect, useMemo, useState, KeyboardEvent } from "react";
import { ArrowUp, AtSign, ChevronDown, FileCode2, Square } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query"; // ✅ added
import { useAppStore } from "@/store/appStore";
import { useChat } from "@/hooks/useChat";
import { MessageBubble } from "./MessageBubble";
import { cn } from "@/lib/utils";
import type { PipelineEvent } from "@/types";
import { AgentTerminal, RunFileSummary } from "./AgentTerminal";
import { BorderBeam } from "border-beam";
import { useProjectFiles } from "@/hooks/useProjects";
import { PromptModelSelector } from "./PromptModelSelector";

const STARTER_FILE_SUGGESTIONS = [
  "src/App.jsx",
  "src/pages/Home.jsx",
  "src/index.css",
  "src/main.jsx",
  "package.json",
];

function splitPipelineRuns(events: PipelineEvent[]) {
  const runs: PipelineEvent[][] = [];
  let current: PipelineEvent[] = [];

  for (const event of events) {
    if (event.type !== "pipeline_update" || !event.stage) continue;
    if (event.stage === "start" && current.length) {
      runs.push(current);
      current = [];
    }

    current.push(event);
    if (event.stage === "done" || event.stage === "error") {
      runs.push(current);
      current = [];
    }
  }

  if (current.length) runs.push(current);
  return runs;
}

export function ChatPanel({ initialPrompt }: { initialPrompt?: string }) {
  const [input, setInput] = useState("");
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const initialPromptSent = useRef(false);

  const qc = useQueryClient(); // ✅ added

  const { activeProject, activeChatId, isBuilding, pipelineEvents, buildProgress, setSelectedFile, setActiveTab } = useAppStore();
  const { data: projectFiles = [] } = useProjectFiles(activeProject?.id ?? null);
  const { messagesQuery, sendMutation, stopBuild, chatId: resolvedChatId } = useChat(activeChatId);
  const messages = useMemo(() => messagesQuery.data ?? [], [messagesQuery.data]);

  useEffect(() => {
    if (!initialPrompt || !activeProject || initialPromptSent.current || sendMutation.isPending || isBuilding) return;
    initialPromptSent.current = true;
    sendMutation.mutate(initialPrompt);
  }, [activeProject, initialPrompt, isBuilding, sendMutation]);

  // ✅ KEY FIX: whenever a new "message" event arrives over WebSocket
  // (stored in pipelineEvents by appStore), invalidate the messages query
  // so React Query refetches and the new message appears immediately.
  useEffect(() => {
    const lastEvent = pipelineEvents[pipelineEvents.length - 1];
    if (!lastEvent) return;

    // "telemetry" is the final event in the pipeline — safe to refetch messages
    // Valid types per PipelineEvent: "pipeline_update" | "telemetry" | "connected" | "pong"
    if (lastEvent.type === "telemetry" || (lastEvent.type === "pipeline_update" && (lastEvent.stage === "done" || lastEvent.stage === "error"))) {
      qc.invalidateQueries({ queryKey: ["messages", resolvedChatId] });
    }
  }, [pipelineEvents, resolvedChatId, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pipelineEvents]);

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const nextInput = e.target.value;
    const cursor = e.target.selectionStart;
    const mention = /(?:^|\s)@([^\s@]*)$/.exec(nextInput.slice(0, cursor));
    setInput(nextInput);
    setMentionStart(mention ? cursor - mention[1].length - 1 : null);
    setMentionQuery(mention?.[1] ?? "");
    setMentionIndex(0);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }

  const mentionFiles = useMemo(() => {
    const files = projectFiles.length > 0
      ? projectFiles.map((file) => ({ id: file.id, path: file.path }))
      : STARTER_FILE_SUGGESTIONS.map((path) => ({ id: `starter-${path}`, path }));
    return files.filter((file) => file.path.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 8);
  }, [projectFiles, mentionQuery]);
  const mentionOpen = mentionStart !== null && mentionFiles.length > 0;

  function openChangedFile(path: string) {
    const file = projectFiles.find((candidate) => candidate.path.replace(/^\/+/, "") === path.replace(/^\/+/, ""));
    if (!file) return;
    setSelectedFile(file);
    setActiveTab("code");
  }

  function insertMention(path: string) {
    if (mentionStart === null) return;
    const cursor = textareaRef.current?.selectionStart ?? input.length;
    const nextInput = `${input.slice(0, mentionStart)}@${path} ${input.slice(cursor)}`;
    const nextCursor = mentionStart + path.length + 2;
    setInput(nextInput);
    setMentionStart(null);
    setMentionQuery("");
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionOpen) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex((index) => (index + 1) % mentionFiles.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex((index) => (index - 1 + mentionFiles.length) % mentionFiles.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(mentionFiles[mentionIndex].path); return; }
      if (e.key === "Escape") { e.preventDefault(); setMentionStart(null); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function handleSend() {
    const text = input.trim();
    if (!text || isBuilding || !activeProject) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    sendMutation.mutate(text);
  }

  async function handleStop() {
    try {
      await stopBuild();
    } catch {
      // Keep the in-progress state unchanged if the server could not stop it.
    }
  }

  const activityRuns = splitPipelineRuns(pipelineEvents);
  const runsByUserMessage = new Map<string, PipelineEvent[][]>();
  const unassignedRuns: PipelineEvent[][] = [];

  for (const run of activityRuns) {
    const firstTimestamp = run[0]?.ts ?? 0;
    const userMessage = messages
      .filter((message) => message.role === "user")
      .map((message) => ({
        message,
        distance: Math.abs(new Date(message.createdAt).getTime() - firstTimestamp),
      }))
      .filter(({ distance }) => distance <= 10_000)
      .sort((a, b) => a.distance - b.distance)[0]?.message;

    if (!userMessage) {
      unassignedRuns.push(run);
      continue;
    }

    const assignedRuns = runsByUserMessage.get(userMessage.id) ?? [];
    assignedRuns.push(run);
    runsByUserMessage.set(userMessage.id, assignedRuns);
  }

  const canSend = !!input.trim() && !!activeProject && !isBuilding;

  return (
    <div className="relative h-full flex flex-col bg-[#1b1c1e]">

      {/* Progress bar */}
      {isBuilding && (
        <div className="h-0.5 shrink-0 bg-white/[0.04] overflow-hidden">
          <div
            className="h-full bg-white transition-all duration-700 ease-in-out"
            style={{
              width: `${buildProgress}%`,
              boxShadow: "0 0 8px rgba(255,255,255,0.35)",
            }}
          />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20">

        {!activeProject && (
          <div className="flex-1 flex items-center justify-center font-mono text-[12px] text-white/20">
            Select or create a project to start building
          </div>
        )}

        {messages.map((msg, messageIndex) => {
          const previousUser = [...messages.slice(0, messageIndex)].reverse().find((message) => message.role === "user");
          const completedRuns = msg.role === "assistant" && msg.metadata?.jobId && previousUser
            ? runsByUserMessage.get(previousUser.id) ?? []
            : [];
          return (
          <React.Fragment key={msg.id}>
            <MessageBubble message={msg} />
            {msg.role === "user" &&
              (runsByUserMessage.get(msg.id) ?? []).map((run) => (
                <AgentTerminal
                  key={run[0]?.ts ?? msg.id}
                  events={run}
                />
              ))}
            {completedRuns.map((run) => <RunFileSummary key={`summary-${run[0]?.ts ?? msg.id}`} events={run} onOpenFile={openChangedFile} />)}
          </React.Fragment>
          );
        })}

        {unassignedRuns.map((run) => (
          <AgentTerminal
            key={run[0]?.ts ?? "unassigned"}
            events={run}
          />
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="relative overflow-visible border-t border-white/[0.07] bg-[#1b1c1e] px-5 pb-5 pt-4 shrink-0">
        {mentionOpen && <div role="listbox" aria-label="Project files" className="absolute bottom-full left-5 right-5 z-50 mb-2 overflow-hidden rounded-2xl border border-white/10 bg-[#111214] p-2 shadow-2xl">
          <p className="px-3 pb-2 pt-1 text-[11px] font-medium text-white/40">Reference a project file</p>
          {mentionFiles.map((file, index) => <button key={file.id} type="button" role="option" aria-selected={index === mentionIndex} onMouseDown={(event) => event.preventDefault()} onClick={() => insertMention(file.path)} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition", index === mentionIndex ? "bg-white/[0.09] text-white" : "text-white/70 hover:bg-white/[0.06]")}>
            <FileCode2 size={16} className="shrink-0 text-sky-300" />
            <span className="min-w-0 flex-1 truncate font-mono text-sm">{file.path}</span>
          </button>)}
          <p className="px-3 pb-1 pt-2 text-[11px] text-white/35">Use arrows and Enter to select · Esc to dismiss</p>
        </div>}
        <BorderBeam size="md" colorVariant="colorful" theme="dark" duration={3.2} brightness={1.7} saturation={1.5} strength={1} glowSize={1.2} className="w-full">
          <form onSubmit={(event) => { event.preventDefault(); handleSend(); }} className="relative flex min-h-[154px] w-full flex-col rounded-[20px] bg-[#1d1d1d] p-2 font-sans tracking-[-0.01em] shadow-[inset_0_0_50px_rgba(255,255,255,.02)]">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.04] text-white/40"><AtSign size={16} /></div>
            {mentionOpen && <div role="listbox" aria-label="Project files" className="absolute bottom-full left-0 right-0 z-20 mb-3 overflow-hidden rounded-2xl border border-white/10 bg-[#111214]/95 p-2 shadow-2xl backdrop-blur-xl">
              <p className="px-3 pb-2 pt-1 text-[11px] font-medium text-white/40">Reference a project file</p>
              {mentionFiles.map((file, index) => <button key={file.id} type="button" role="option" aria-selected={index === mentionIndex} onMouseDown={(event) => event.preventDefault()} onClick={() => insertMention(file.path)} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition", index === mentionIndex ? "bg-white/[0.09] text-white" : "text-white/70 hover:bg-white/[0.06]")}>
                <FileCode2 size={16} className="shrink-0 text-sky-300" />
                <span className="min-w-0 flex-1 truncate font-mono text-sm">{file.path}</span>
              </button>)}
              <p className="px-3 pb-1 pt-2 text-[11px] text-white/35">↑↓ to choose · Enter to reference · Esc to dismiss</p>
            </div>}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={activeProject ? "Ask a follow-up..." : "Select a project first"}
              disabled={!activeProject || isBuilding}
              rows={1}
              className={cn(
                "mt-3 min-h-8 w-full resize-none bg-transparent px-1 text-[17px] leading-6 text-white/90 outline-none placeholder:text-[17px] placeholder:text-white/45 max-h-[160px]",
                (!activeProject || isBuilding) && "opacity-40"
              )}
            />
            <div className="mt-auto flex items-center gap-2">
              <button type="button" className="flex h-8 items-center gap-1 rounded-full bg-white/[0.05] px-3 text-[13px] text-white/80 hover:bg-white/10">Agent <ChevronDown size={14} className="text-white/40" /></button>
              <PromptModelSelector />
              {isBuilding ? (
                <button
                  type="button"
                  onClick={handleStop}
                  aria-label="Stop build"
                  title="Stop build"
                  className="ml-auto inline-flex h-9 items-center gap-2 rounded-full bg-red-400/15 px-3.5 text-[13px] font-medium text-red-100 transition hover:bg-red-400/25"
                >
                  <Square size={12} fill="currentColor" />
                  Stop build
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!canSend}
                  aria-label="Send message"
                  title="Send message"
                  className="ml-auto grid h-9 w-9 place-items-center rounded-full bg-white/[0.05] text-white/55 transition hover:bg-white/10 disabled:opacity-40"
                >
                  <ArrowUp size={17} />
                </button>
              )}
            </div>
          </form>
        </BorderBeam>
      </div>

    </div>
  );
}
