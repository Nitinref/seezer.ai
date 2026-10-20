"use client";

import React, { useEffect, useRef, useState } from "react";
import { Code2, Globe2, MoreHorizontal, Plus, Rocket } from "lucide-react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { CenterPanel } from "@/components/preview/CenterPanel";
import { useAppStore } from "@/store/appStore";

export function AppShell({ initialPrompt }: { initialPrompt?: string }) {
  const [previewWidth, setPreviewWidth] = useState(70);
  const dragging = useRef(false);
  const { activeProject, activeTab, setActiveTab } = useAppStore();

  useEffect(() => {
    const saved = Number(window.localStorage.getItem("sizzer.previewWidth.v3"));
    if (Number.isFinite(saved) && saved >= 55 && saved <= 90) setPreviewWidth(saved);

    const move = (event: PointerEvent) => {
      if (!dragging.current) return;
      const shell = document.getElementById("app-workspace");
      if (!shell) return;
      const rect = shell.getBoundingClientRect();
      const chatWidth = ((event.clientX - rect.left) / rect.width) * 100;
      setPreviewWidth(Math.min(90, Math.max(55, 100 - chatWidth)));
    };
    const stop = () => {
      dragging.current = false;
      document.body.style.cursor = "";
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem("sizzer.previewWidth.v3", String(previewWidth));
  }, [previewWidth]);

  return (
    <div className="flex h-screen w-full max-w-full flex-col overflow-hidden bg-[#151515] text-white">
      <header className="flex h-[62px] shrink-0 border-b border-white/[0.1] bg-[#101011]">
        <div
          className="flex min-w-0 items-center border-r border-white/[0.1] px-5"
          style={{ width: `${100 - previewWidth}%` }}
        >
          <span className="truncate text-[17px] font-medium text-white/90">
            {activeProject?.name ?? "New project"}
          </span>
          <span className="ml-auto text-white/45">⌄</span>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-3 px-5">
          <button onClick={() => setActiveTab("preview")} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[15px] font-medium ${activeTab === "preview" ? "bg-[#17191c] text-white/90" : "text-white/45 hover:bg-white/5 hover:text-white"}`}>
            <Globe2 size={17} className="text-white/70" /> Preview
          </button>
          <button onClick={() => setActiveTab("code")} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[15px] font-medium ${activeTab === "code" ? "bg-[#17191c] text-white/90" : "text-white/45 hover:bg-white/5 hover:text-white"}`}>
            <Code2 size={17} className="text-white/70" /> Code
          </button>
          <button aria-label="Add tab" className="rounded-lg p-2 text-white/55 transition hover:bg-white/10 hover:text-white">
            <Plus size={19} />
          </button>
          <button className="ml-auto flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2 text-[15px] font-semibold text-white transition hover:bg-sky-400">
            <Rocket size={16} /> Publish
          </button>
          <button aria-label="More options" className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white">
            <MoreHorizontal size={20} />
          </button>
        </div>
      </header>
      <div id="app-workspace" className="flex min-h-0 flex-1 overflow-hidden bg-[#171717]">
        <div className="min-w-0 h-full" style={{ width: `${100 - previewWidth}%` }}>
          <ChatPanel initialPrompt={initialPrompt} />
        </div>
        <div
          role="separator"
          aria-label="Resize preview and chat panels"
          onPointerDown={(event) => {
            event.preventDefault();
            dragging.current = true;
            document.body.style.cursor = "col-resize";
          }}
          className="group z-20 hidden w-1 shrink-0 cursor-col-resize border-l border-white/[0.08] bg-[#050505] hover:border-white/30 md:block"
          title="Drag to resize preview"
        />
        <div className="min-w-0 h-full flex-1">
          <CenterPanel />
        </div>
      </div>
    </div>
  );
}
