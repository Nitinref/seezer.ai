"use client";
import React, { useRef, useEffect, useState, KeyboardEvent } from "react";
import { ArrowUp, AtSign, ChevronDown, RotateCcw, ChevronRight, Globe2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query"; // ✅ added
import { useAppStore } from "@/store/appStore";
import { useChat } from "@/hooks/useChat";
import { MessageBubble } from "./MessageBubble";
import { cn } from "@/lib/utils";
import type { PipelineEvent } from "@/types";
import { AgentTerminal } from "./AgentTerminal";
import { BorderBeam } from "border-beam";

export function ChatPanel({ initialPrompt }: { initialPrompt?: string }) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const initialPromptSent = useRef(false);

  const qc = useQueryClient(); // ✅ added

  const { activeProject, activeChatId, isBuilding, pipelineEvents, buildProgress } = useAppStore();
  const { messagesQuery, sendMutation, chatId: resolvedChatId } = useChat(activeChatId);
  const messages = messagesQuery.data ?? [];

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
    if (lastEvent.type === "telemetry") {
      qc.invalidateQueries({ queryKey: ["messages", resolvedChatId] });
    }
  }, [pipelineEvents, resolvedChatId, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pipelineEvents]);

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function handleSend() {
    const text = input.trim();
    if (!text || isBuilding || !activeProject) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    sendMutation.mutate(text);
  }

  const telemetry = pipelineEvents.findLast((e: PipelineEvent) => e.type === "telemetry");
  const canSend = !!input.trim() && !!activeProject && !isBuilding;

  return (
    <div className="relative h-full flex flex-col bg-[#0f1011]">

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
      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20">

        {!activeProject && (
          <div className="flex-1 flex items-center justify-center font-mono text-[12px] text-white/20">
            Select or create a project to start building
          </div>
        )}

        {messages.map(msg => <MessageBubble key={msg.id} message={msg} />)}

        <AgentTerminal
          events={pipelineEvents.filter((e) => e.type === "pipeline_update" && !!e.stage)}
          tokens={telemetry?.tokens}
        />

        <div ref={bottomRef} />
      </div>

      {/* Ready-to-publish strip */}
      {!isBuilding && messages.length > 0 && (
        <div className="mx-5 mb-3 flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-[#151617] px-4 py-3 text-[13px]">
          <Globe2 size={17} className="text-white/45" />
          <span className="font-semibold text-white/80">Ready to go live?</span>
          <button className="ml-auto flex items-center gap-1 text-white/45 hover:text-white/80">Publish <ChevronRight size={15} /></button>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-white/[0.07] bg-[#0f1011] px-5 pb-5 pt-4 shrink-0">
        <BorderBeam size="md" colorVariant="colorful" theme="dark" duration={3.2} brightness={1.7} saturation={1.5} strength={1} glowSize={1.2} className="w-full">
          <form onSubmit={(event) => { event.preventDefault(); handleSend(); }} className="relative flex min-h-[154px] w-full flex-col rounded-[20px] bg-[#1d1d1d] p-2 font-sans tracking-[-0.01em] shadow-[inset_0_0_50px_rgba(255,255,255,.02)]">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.04] text-white/40"><AtSign size={16} /></div>
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
              <button type="button" className="flex h-8 items-center gap-1 rounded-full bg-white/[0.05] px-3 text-[13px] text-white/80 hover:bg-white/10">Auto <ChevronDown size={14} className="text-white/40" /></button>
              <button type="submit" disabled={!canSend} aria-label="Send message" className="ml-auto grid h-9 w-9 place-items-center rounded-full bg-white/[0.05] text-white/55 transition hover:bg-white/10 disabled:opacity-40">
                {isBuilding ? <RotateCcw size={15} className="animate-spin" /> : <ArrowUp size={17} />}
              </button>
            </div>
          </form>
        </BorderBeam>
      </div>

    </div>
  );
}
