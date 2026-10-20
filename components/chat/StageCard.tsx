"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { PipelineEvent, PipelineStage } from "@/types";

const STAGE_CONFIG: Partial<Record<
  PipelineStage,
  { icon: string; text: string }
>> = {
  start: { icon: "▶", text: "text-white" },
  sandbox: { icon: "📦", text: "text-white" },
  planning: { icon: "🧠", text: "text-white" },
  agent: { icon: "🤖", text: "text-white" },
  building: { icon: "⚙️", text: "text-white" },
  validating: { icon: "🔍", text: "text-white" },
  checking: { icon: "✅", text: "text-white" },
  done: { icon: "🚀", text: "text-white" },
  error: { icon: "❌", text: "text-white" },
  preview: { icon: "🌐", text: "text-white" },
};

interface Props {
  event: PipelineEvent & { stage: PipelineStage };
}

export function StageCard({ event }: Props) {
  const cfg = STAGE_CONFIG[event.stage] ?? { icon: "•", text: "text-white" };

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border px-3 py-2",
        "border-neutral-700 bg-neutral-900",
        "transition-all duration-150",
        "hover:border-neutral-500"
      )}
    >
      {/* Icon */}
      <div className="text-sm mt-0.5 shrink-0 text-neutral-300">
        {cfg.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-[10px] uppercase tracking-wider mb-1",
            "text-neutral-400"
          )}
        >
          {event.stage}
        </p>

        <p
          className={cn(
            "text-sm leading-relaxed break-words",
            cfg.text
          )}
        >
          {event.message}
        </p>

        {/* Preview */}
        {event.previewUrl && (
          <a
            href={event.previewUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-2 text-xs text-neutral-300 hover:text-white transition"
          >
            ↗ Open Preview
          </a>
        )}

        {/* Replans */}
        {event.replans !== undefined && event.replans > 0 && (
          <p className="text-xs text-neutral-400 mt-1">
            Replanned {event.replans}×
          </p>
        )}
      </div>
    </div>
  );
}
