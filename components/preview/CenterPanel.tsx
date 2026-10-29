"use client";

import React, { useState } from "react";
import { ArrowLeft, ArrowRight, Code2, ExternalLink, Gift, RefreshCw, Smartphone } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { CodeViewer } from "./CodeViewer";
import LiquidWaveSpinner from "@/components/ui/spinner-10";
import { projectsApi } from "@/lib/api";

export function CenterPanel() {
  const { activeProject, activeTab, setActiveTab, previewUrl, setPreviewUrl, isBuilding, buildProgress, pipelineEvents } = useAppStore();
  const [isRestoringPreview, setIsRestoringPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [mobilePreview, setMobilePreview] = useState(false);
  const lastEvent = pipelineEvents.findLast((event) => event.type === "pipeline_update" && event.stage);
  const stage = lastEvent?.stage ?? "";

  const restorePreview = async () => {
    if (!activeProject?.id || isRestoringPreview) return;
    setIsRestoringPreview(true);
    setPreviewError(null);
    try {
      const { previewUrl: freshPreviewUrl } = await projectsApi.restorePreview(activeProject.id);
      setPreviewUrl(freshPreviewUrl);
    } catch {
      setPreviewError("Could not restart this preview. Please try again in a moment.");
    } finally {
      setIsRestoringPreview(false);
    }
  };

  return (
    <main className="m-2 flex h-[calc(100%-16px)] min-w-0 flex-col overflow-hidden rounded-xl border border-white/[0.16] bg-[#101012]">
      <div className="h-0.5 shrink-0 bg-white/[0.04]">
        <div className="h-full bg-white/70 transition-all" style={{ width: `${buildProgress}%`, opacity: isBuilding || buildProgress ? 1 : 0 }} />
      </div>

      {activeTab === "preview" && <div className="flex h-[54px] shrink-0 items-center justify-center border-b border-white/[0.08]">
        <div className="flex h-9 w-[min(640px,90%)] items-center gap-4 rounded-lg border border-white/15 bg-[#080808] px-3 text-white/45 shadow-xl">
          <button aria-label="Back"><ArrowLeft size={15} /></button>
          <button aria-label="Forward"><ArrowRight size={15} /></button>
          <button
            type="button"
            onClick={() => setMobilePreview((enabled) => !enabled)}
            aria-label={mobilePreview ? "Use desktop preview" : "Use mobile preview"}
            aria-pressed={mobilePreview}
            title={mobilePreview ? "Desktop preview" : "Mobile preview"}
            className={mobilePreview ? "text-sky-300" : "text-white/45 hover:text-white/80"}
          >
            <Smartphone size={15} />
          </button>
          <span className="flex-1 truncate text-center text-sm text-white/75">{previewUrl?.replace(/^https?:\/\//, "") ?? "/"}</span>
          <button onClick={() => previewUrl && window.open(previewUrl, "_blank")} aria-label="Open preview"><ExternalLink size={15} /></button>
          <button onClick={restorePreview} disabled={!activeProject?.id || isRestoringPreview} aria-label="Restart preview" title="Restart preview" className="disabled:cursor-not-allowed disabled:opacity-40"><RefreshCw size={15} className={isRestoringPreview ? "animate-spin" : ""} /></button>
          <button onClick={() => setActiveTab(activeTab === "preview" ? "code" : "preview")} aria-label="Toggle code"><Code2 size={15} /></button>
        </div>
      </div>}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {activeTab === "code" && <div className="absolute inset-0 overflow-auto"><CodeViewer /></div>}

        {previewUrl && <div
          className={mobilePreview
            ? "absolute bottom-3 left-1/2 top-3 w-[min(390px,calc(100%-24px))] -translate-x-1/2 overflow-hidden rounded-[28px] border-[6px] border-zinc-800 bg-black shadow-2xl shadow-black/60"
            : "absolute inset-0"}
          style={{ display: activeTab === "preview" ? "block" : "none" }}
        >
          {mobilePreview && <div className="absolute left-1/2 top-1 z-10 h-1.5 w-16 -translate-x-1/2 rounded-full bg-zinc-700" />}
          <iframe src={previewUrl} className="h-full w-full border-0" title={mobilePreview ? "Mobile preview" : "Desktop preview"} />
        </div>}

        {activeTab === "preview" && !previewUrl && !isBuilding && <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center text-white/60">
          <Gift size={108} strokeWidth={1.2} className="text-blue-500" />
          <h2 className="text-[22px] font-semibold text-white/90">Refer &amp; earn</h2>
          <p className="max-w-[390px] text-[18px] leading-7 text-white/55">Share Seezer with friends and get rewarded when they subscribe</p>
          <button className="rounded-lg border border-white/20 px-5 py-3 text-[16px] font-semibold text-white/80 hover:bg-white/10"><Gift size={16} className="mr-2 inline" />Earn $50</button>
          <p className="mt-5 text-[20px] text-white/55">Your preview will appear here</p>
          <div className="absolute bottom-7 flex gap-8 text-blue-400"><span>◉ Help Center</span><span>♣ Join our Community</span></div>
        </div>}

        {(isRestoringPreview || (isBuilding && !previewUrl)) && activeTab === "preview" && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#050505]/90 px-6 backdrop-blur-sm">
          <LiquidWaveSpinner size="lg" className="max-w-sm bg-transparent" />
          <p className="mt-2 text-sm text-white/65">{stage || "Building"} · {buildProgress}%</p>
        </div>}
        {previewError && activeTab === "preview" && <div className="absolute inset-x-5 bottom-5 z-20 flex items-center justify-between gap-4 rounded-lg border border-rose-400/30 bg-[#201013]/95 px-4 py-3 text-sm text-rose-100 shadow-xl">
          <span>{previewError}</span>
          <button type="button" onClick={restorePreview} className="shrink-0 font-medium text-white underline underline-offset-4">Retry</button>
        </div>}
      </div>
    </main>
  );
}
