"use client";

import React from "react";
import { ArrowLeft, ArrowRight, Code2, ExternalLink, Gift, Monitor, RefreshCw, Smartphone, Zap } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { CodeViewer } from "./CodeViewer";

export function CenterPanel() {
  const { activeTab, setActiveTab, previewUrl, isBuilding, buildProgress, pipelineEvents } = useAppStore();
  const lastEvent = pipelineEvents.findLast((event) => event.type === "pipeline_update" && event.stage);
  const stage = lastEvent?.stage ?? "";

  return (
    <main className="m-2 flex h-[calc(100%-16px)] min-w-0 flex-col overflow-hidden rounded-xl border border-white/[0.16] bg-[#101012]">
      <div className="h-0.5 shrink-0 bg-white/[0.04]">
        <div className="h-full bg-white/70 transition-all" style={{ width: `${buildProgress}%`, opacity: isBuilding || buildProgress ? 1 : 0 }} />
      </div>

      {activeTab === "preview" && <div className="flex h-[54px] shrink-0 items-center justify-center border-b border-white/[0.08]">
        <div className="flex h-9 w-[min(640px,90%)] items-center gap-4 rounded-lg border border-white/15 bg-[#080808] px-3 text-white/45 shadow-xl">
          <button aria-label="Back"><ArrowLeft size={15} /></button>
          <button aria-label="Forward"><ArrowRight size={15} /></button>
          <Smartphone size={15} />
          <span className="flex-1 truncate text-center text-sm text-white/75">{previewUrl?.replace(/^https?:\/\//, "") ?? "/"}</span>
          <button onClick={() => previewUrl && window.open(previewUrl, "_blank")} aria-label="Open preview"><ExternalLink size={15} /></button>
          <button onClick={() => window.location.reload()} aria-label="Refresh"><RefreshCw size={15} /></button>
          <button onClick={() => setActiveTab(activeTab === "preview" ? "code" : "preview")} aria-label="Toggle code"><Code2 size={15} /></button>
        </div>
      </div>}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {activeTab === "code" && <div className="absolute inset-0 overflow-auto"><CodeViewer /></div>}

        {previewUrl && <iframe src={previewUrl} className="absolute inset-0 h-full w-full border-0" title="Preview" style={{ display: activeTab === "preview" ? "block" : "none" }} />}

        {activeTab === "preview" && !previewUrl && !isBuilding && <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center text-white/60">
          <Gift size={108} strokeWidth={1.2} className="text-blue-500" />
          <h2 className="text-[22px] font-semibold text-white/90">Refer &amp; earn</h2>
          <p className="max-w-[390px] text-[18px] leading-7 text-white/55">Share Seezer with friends and get rewarded when they subscribe</p>
          <button className="rounded-lg border border-white/20 px-5 py-3 text-[16px] font-semibold text-white/80 hover:bg-white/10"><Gift size={16} className="mr-2 inline" />Earn $50</button>
          <p className="mt-5 text-[20px] text-white/55">Your preview will appear here</p>
          <div className="absolute bottom-7 flex gap-8 text-blue-400"><span>◉ Help Center</span><span>♣ Join our Community</span></div>
        </div>}

        {isBuilding && activeTab === "preview" && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#050505]/90 backdrop-blur-sm">
          <Zap size={24} className="animate-pulse text-white/55" />
          <p className="text-sm text-white/65">{stage || "Building"} · {buildProgress}%</p>
        </div>}
      </div>
    </main>
  );
}
