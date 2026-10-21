"use client";

import React from "react";
import { Check, ChevronDown, ClipboardList, Sparkles } from "lucide-react";
import type { Message } from "@/types";
import { Trace, TraceLine, TraceIcon, TraceTitle } from "@/components/ui/trace";
import { Deck } from "@/components/mcp/hairline/Deck";

export function PlanCard({ message }: { message: Message }) {
  const title = message.metadata?.jobId ? "Build plan ready" : "Plan written";
  const body = message.content.trim();
  const lines = body.split(/\n+/).map((line) => line.replace(/^[-*•]\s*/, "").trim()).filter(Boolean);
  const intro = lines[0] ?? "Your project plan is ready to review.";
  const items = lines.slice(1, 6);

  return (
    <article className="overflow-hidden rounded-2xl border border-white/[0.12] bg-[#101112] font-sans tracking-[-0.01em] shadow-[0_18px_60px_rgba(0,0,0,.22)]">
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3 text-[12px] text-white/45">
        <span className="flex items-center gap-2"><ClipboardList size={14} /> {title}</span>
        <span className="flex items-center gap-1 text-white/30">now <ChevronDown size={13} /></span>
      </div>
      <div className="bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,.12),transparent_42%)] px-6 py-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-sky-300/80"><Sparkles size={14} /> Proposed plan</p>
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300"><Check size={13} /> Ready</span>
        </div>
        <h3 className="text-[18px] font-semibold tracking-tight text-white">{intro}</h3>
        {items.length > 0 && (
          <Deck
            done={items.map(() => false)}
            label="Plan steps waiting to be built"
            className="mx-auto mt-4 max-w-[260px] opacity-90"
          />
        )}
        {items.length > 0 ? (
          <Trace className="mt-5 space-y-2">
            {items.map((item, index) => (
              <TraceLine key={`${item}-${index}`} className="rounded-lg px-2 py-2 text-[14px] text-white/70 transition hover:bg-white/[0.04]">
                <TraceIcon><span className="grid h-5 w-5 place-items-center rounded-full border border-sky-400/25 bg-sky-400/10 text-[10px] font-bold text-sky-300">{index + 1}</span></TraceIcon>
                <TraceTitle className="whitespace-normal leading-6">{item}</TraceTitle>
              </TraceLine>
            ))}
          </Trace>
        ) : <p className="mt-3 text-[17px] leading-8 text-white/60">{body}</p>}
      </div>
      <div className="border-t border-white/[0.08] px-6 py-4 text-[14px] text-white/38">What you&apos;ll get · a working app, editable source, and live preview</div>
    </article>
  );
}
