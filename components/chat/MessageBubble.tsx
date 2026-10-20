"use client";
import React from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/types";
import { PlanCard } from "./PlanCard";

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  if (message.role === "assistant") return <div className="w-full"><PlanCard message={message} /></div>;

  return (
    <div className={cn("flex flex-col", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[88%] rounded-2xl px-5 py-4 font-sans text-[17px] leading-8 tracking-[-0.01em]",
          isUser
            ? "rounded-br-md border border-white/[0.08] bg-[#242629] text-white"
            : "rounded-bl-md border border-white/[0.08] bg-[#1c1d1f] text-white/80"
        )}
      >
        {message.content}
        {message.metadata?.previewUrl && (
          <a
            href={message.metadata.previewUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 mt-2 text-gray-600 hover:text-gray-900 transition-colors text-[11px]"
          >
            <ExternalLink className="w-3 h-3" />
            Open Preview
          </a>
        )}
      </div>
    </div>
  );
}
