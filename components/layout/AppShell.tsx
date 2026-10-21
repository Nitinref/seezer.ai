"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Code2,
  Globe2,
  MessageSquare,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Rocket,
} from "lucide-react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { CenterPanel } from "@/components/preview/CenterPanel";
import { ProjectsSidebar } from "@/components/sidebar/ProjectsSidebar";
import { useAppStore } from "@/store/appStore";

export function AppShell({
  initialPrompt,
  onNewProject,
  onBackToDashboard,
}: {
  initialPrompt?: string;
  onNewProject?: () => void;
  onBackToDashboard?: () => void;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [previewWidth, setPreviewWidth] = useState(70);
  const [mobilePanel, setMobilePanel] = useState<"chat" | "preview">("chat");
  const dragging = useRef(false);
  const { activeProject, activeTab, setActiveTab } = useAppStore();

  useEffect(() => {
    const saved = Number(window.localStorage.getItem("sizzer.previewWidth.v3"));
    if (Number.isFinite(saved) && saved >= 55 && saved <= 90) setPreviewWidth(saved);

    const savedSidebar = window.localStorage.getItem("sizzer.sidebarOpen");
    if (savedSidebar !== null) {
      setSidebarOpen(savedSidebar === "true");
    }

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

  const handleToggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      window.localStorage.setItem("sizzer.sidebarOpen", String(next));
      return next;
    });
  };

  return (
    <div className="flex h-screen w-full max-w-full overflow-hidden bg-[#151515] text-white">
      {/* Collapsible Projects Sidebar to the left of Chat */}
      <ProjectsSidebar
        open={sidebarOpen}
        onToggle={handleToggleSidebar}
        onNewProject={onNewProject}
        onBackToDashboard={onBackToDashboard}
      />

      {/* Main Workspace (Header + Chat + Preview) */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Desktop Header */}
        <header className="hidden h-[62px] shrink-0 border-b border-white/[0.08] bg-[#101011] md:flex">
          <div
            className="flex min-w-0 items-center gap-2.5 border-r border-white/[0.08] px-4"
            style={{ width: `${100 - previewWidth}%` }}
          >
            <button
              type="button"
              onClick={handleToggleSidebar}
              aria-label={sidebarOpen ? "Close projects sidebar" : "Open projects sidebar"}
              title={sidebarOpen ? "Close sidebar" : "Open sidebar (View projects)"}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-zinc-400 transition hover:bg-white/[0.08] hover:text-white"
            >
              {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            </button>
            <span className="truncate text-[16px] font-medium text-white/90">
              {activeProject?.name ?? "New project"}
            </span>
            <span className="ml-auto text-white/45">⌄</span>
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-3 px-5">
            <button
              onClick={() => setActiveTab("preview")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[15px] font-medium transition ${
                activeTab === "preview"
                  ? "bg-[#17191c] text-white/90"
                  : "text-white/45 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Globe2 size={17} className="text-white/70" /> Preview
            </button>
            <button
              onClick={() => setActiveTab("code")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[15px] font-medium transition ${
                activeTab === "code"
                  ? "bg-[#17191c] text-white/90"
                  : "text-white/45 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Code2 size={17} className="text-white/70" /> Code
            </button>
            <button
              aria-label="Add tab"
              className="rounded-lg p-2 text-white/55 transition hover:bg-white/10 hover:text-white"
            >
              <Plus size={19} />
            </button>
            <button className="ml-auto flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2 text-[15px] font-semibold text-white transition hover:bg-sky-400">
              <Rocket size={16} /> Publish
            </button>
            <button
              aria-label="More options"
              className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white"
            >
              <MoreHorizontal size={20} />
            </button>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/[0.08] bg-[#101011] px-3 md:hidden">
          <button
            type="button"
            onClick={handleToggleSidebar}
            aria-label="Toggle projects sidebar"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-400 hover:text-white"
          >
            <PanelLeftOpen size={18} />
          </button>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-white/90">
            {activeProject?.name ?? "New project"}
          </span>
          <button
            type="button"
            onClick={() => setMobilePanel("chat")}
            aria-pressed={mobilePanel === "chat"}
            className={`flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium ${
              mobilePanel === "chat" ? "bg-white/10 text-white" : "text-white/55"
            }`}
          >
            <MessageSquare size={15} /> Chat
          </button>
          <button
            type="button"
            onClick={() => {
              setMobilePanel("preview");
              setActiveTab("preview");
            }}
            aria-pressed={mobilePanel === "preview" && activeTab === "preview"}
            className={`flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium ${
              mobilePanel === "preview" && activeTab === "preview"
                ? "bg-white/10 text-white"
                : "text-white/55"
            }`}
          >
            <Globe2 size={15} /> Preview
          </button>
          <button
            type="button"
            onClick={() => {
              setMobilePanel("preview");
              setActiveTab("code");
            }}
            aria-pressed={mobilePanel === "preview" && activeTab === "code"}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
              mobilePanel === "preview" && activeTab === "code"
                ? "bg-white/10 text-white"
                : "text-white/55"
            }`}
            aria-label="Show code"
          >
            <Code2 size={16} />
          </button>
        </header>

        {/* Workspace body (ChatPanel + Resizer + CenterPanel) */}
        <div
          id="app-workspace"
          className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#171717] md:flex-row"
        >
          <div
            className={`${
              mobilePanel === "chat" ? "flex" : "hidden"
            } min-h-0 min-w-0 flex-1 md:block md:h-full md:flex-none md:w-[var(--chat-width)]`}
            style={
              { "--chat-width": `${100 - previewWidth}%` } as React.CSSProperties
            }
          >
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
          <div
            className={`${
              mobilePanel === "preview" ? "flex" : "hidden"
            } min-h-0 min-w-0 flex-1 md:block md:h-full`}
          >
            <CenterPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
