"use client";

import React from "react";
import { Check, ChevronDown, ClipboardList } from "lucide-react";
import type { Message } from "@/types";

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
      <div className="px-6 py-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[14px] text-sky-300/75">Proposed plan</p>
          <span className="flex items-center gap-1.5 text-[14px] text-emerald-300/80"><Check size={15} /> Approved</span>
        </div>
        <h3 className="text-[18px] font-semibold tracking-tight text-white">{intro}</h3>
        {items.length > 0 ? <ul className="mt-5 space-y-4 text-[17px] leading-8 text-white/70">{items.map((item, index) => <li key={`${item}-${index}`} className="flex gap-3"><span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-white/35" /><span>{item}</span></li>)}</ul> : <p className="mt-3 text-[17px] leading-8 text-white/60">{body}</p>}
      </div>
      <div className="border-t border-white/[0.08] px-6 py-4 text-[14px] text-white/38">What you&apos;ll get · a working app, editable source, and live preview</div>
    </article>
  );
}
