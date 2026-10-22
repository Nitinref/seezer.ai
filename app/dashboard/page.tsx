"use client";

import { useState } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  ArrowLeft,
  AtSign,
  ChevronDown,
  GitBranch,
  Search,
  Trash2,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppShell } from "@/components/layout/AppShell";
import { useProjects } from "@/hooks/useProjects";
import { useAuthStore } from "@/store/authStore";
import { useAppStore } from "@/store/appStore";
import { BorderBeam } from "border-beam";
import { ShaderBackground } from "@/components/ui/purp-wave-shader";
import GlassProjectFolder from "@/components/ui/glass-folder-cards";
import AceternitySidebar from "@/components/sidebar/AceternitySidebar";
import { SizzerLogo } from "@/components/brand/SizzerLogo";
import { PromptModelSelector } from "@/components/chat/PromptModelSelector";

function projectNameFromPrompt(prompt: string) {
  const cleaned = prompt
    .replace(/^(build|create|make|design|develop|generate)\s+/i, "")
    .replace(/[.!?].*$/, "")
    .trim();
  const words = cleaned.split(/\s+/).slice(0, 5);
  const name = words
    .join(" ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  return name.slice(0, 34) || "New AI Project";
}

function ChatInput({ prompt, setPrompt, onSubmit }: { prompt: string; setPrompt: (value: string) => void; onSubmit: () => void }) {
  return <BorderBeam size="md" colorVariant="colorful" theme="dark" duration={3.2} brightness={1.7} saturation={1.5} strength={1} glowSize={1.2} className="mx-auto mt-12 w-full max-w-[760px]">
    <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} className="relative flex h-[154px] w-full flex-col rounded-[20px] bg-[#1d1d1d] p-2 font-sans tracking-[-0.01em] shadow-[inset_0_0_50px_rgba(255,255,255,.02)]">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.04] text-white/40"><AtSign size={16} /></div>
      <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSubmit(); } }} rows={3} autoFocus placeholder="Build anything..." className="mt-3 min-h-0 w-full flex-1 resize-none overflow-y-auto bg-transparent px-1 text-[17px] leading-6 text-white/90 outline-none placeholder:text-[17px] placeholder:text-white/45" />
      <div className="mt-auto flex items-center gap-2"><button type="button" className="flex h-7 items-center gap-1 rounded-full bg-white/[0.05] px-2.5 text-[13px] text-white/80 hover:bg-white/10">Agent <ChevronDown size={14} className="text-white/40" /></button><PromptModelSelector /><button type="submit" disabled={!prompt.trim()} aria-label="Start building" className="ml-auto grid h-8 w-8 place-items-center rounded-full bg-white/[0.05] text-white/55 transition hover:bg-white/10 disabled:opacity-40"><ArrowUp size={16} /></button></div>
    </form>
  </BorderBeam>;
}

function DashboardHome({ onStart, onOpenProject }: { onStart: (prompt: string) => void; onOpenProject: (project: any) => void }) {
  const [prompt, setPrompt] = useState("");
  const [showExisting, setShowExisting] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const { projects, isLoading, deleteMutation } = useProjects();
  const user = useAuthStore((state) => state.user);
  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(projectSearch.toLowerCase()),
  );

  function submit() {
    if (prompt.trim()) onStart(prompt.trim());
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#0d0e11] text-white md:flex-row">
      <AceternitySidebar onNewProject={() => setShowExisting(false)} />
      <main className="dashboard-aurora relative isolate m-2 mt-2 min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto rounded-t-[26px] border border-white/10 bg-[#05070d] [&>header]:relative [&>header]:z-10 [&>section]:relative [&>section]:z-10">
        <ShaderBackground className="pointer-events-none absolute inset-0 z-0 h-full w-full" />
        <header className="relative z-10 flex items-center justify-between px-5 py-4 lg:px-8">
          <SizzerLogo className="text-white lg:hidden" iconClassName="h-7 w-7" wordmarkClassName="text-lg" />
          <div className="ml-auto flex items-center gap-3 text-sm text-white/60">
            <button className="rounded-lg border border-white/10 px-3 py-2 hover:bg-white/10">
              Help
            </button>
            <button className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-cyan-300 to-blue-600 text-xs font-bold">
              {(user?.name ?? user?.email ?? "S").slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>
        {!showExisting ? (
          <section className="mx-auto flex min-h-[610px] max-w-[1050px] flex-col items-center px-5 pb-12 pt-16 text-center sm:pt-24">
            <h1 className="text-[clamp(42px,6vw,76px)] font-semibold leading-[.95] tracking-[-0.07em]">
              What will you build today?
            </h1>
            <p className="mt-5 text-[clamp(17px,2vw,24px)] text-white/70">
              Create apps and websites by chatting with AI.
            </p>
            <ChatInput prompt={prompt} setPrompt={setPrompt} onSubmit={submit} />
            <button
              type="button"
              onClick={() => setShowExisting(true)}
              className="mt-7 inline-flex items-center gap-2 text-[15px] text-white/55 transition hover:text-white"
            >
              Continue an existing project <ArrowUpRight size={16} />
            </button>
          </section>
        ) : (
          <section className="min-h-[calc(100vh-72px)] bg-transparent px-4 py-8 text-left sm:px-8 sm:py-12 xl:px-16">
            <div className="mx-auto max-w-[1280px]">
              <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:gap-6">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-sky-400">
                    Your workspace
                  </p>
                  <h1 className="mt-4 text-4xl font-light tracking-[-0.06em] text-white sm:mt-7 sm:text-6xl">
                    Made by you.
                  </h1>
                  <p className="mt-4 text-lg text-white/45">
                    Your projects, ready to pick up again.
                  </p>
                </div>
                <div className="flex w-full items-center gap-3 sm:mt-8 sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setShowExisting(false)}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#151619] px-4 py-3 text-sm font-medium text-white/65 transition hover:bg-[#202125] hover:text-white"
                  >
                    <ArrowLeft size={17} /> Back
                  </button>
                  <button className="hidden items-center gap-3 rounded-xl border border-white/10 bg-[#151619] px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-[#202125] sm:flex">
                    <GitBranch size={17} /> Import from GitHub
                  </button>
                </div>
              </div>
              <div className="mt-16 grid gap-5 lg:grid-cols-[minmax(0,1fr)_200px_240px]">
                <label className="block text-sm text-white/40">
                  Search projects
                  <div className="mt-2 flex h-13 items-center gap-3 rounded-xl border border-white/10 bg-[#151619] px-4">
                    <Search size={19} className="text-white/40" />
                    <input
                      value={projectSearch}
                      onChange={(event) => setProjectSearch(event.target.value)}
                      placeholder="Find a project by name"
                      className="w-full bg-transparent text-base text-white outline-none placeholder:text-white/35"
                    />
                  </div>
                </label>
                <label className="block text-sm text-white/40">
                  Created
                  <select className="mt-2 h-13 w-full rounded-xl border border-white/10 bg-[#151619] px-4 text-base text-white/80 outline-none">
                    <option>All time</option>
                  </select>
                </label>
                <label className="block text-sm text-white/40">
                  Sort by
                  <select className="mt-2 h-13 w-full rounded-xl border border-white/10 bg-[#151619] px-4 text-base text-white/80 outline-none">
                    <option>Recently updated</option>
                  </select>
                </label>
              </div>
              <div className="mt-10 flex items-center justify-between text-sm text-white/45">
                <span>{filteredProjects.length} {filteredProjects.length === 1 ? "project" : "projects"}</span>
                <button type="button" onClick={() => setShowExisting(false)} className="text-white/45 hover:text-white">
                  Back to builder
                </button>
              </div>
              {isLoading ? (
                <p className="mt-10 text-white/45">Loading projects...</p>
              ) : filteredProjects.length === 0 ? (
                <p className="mt-10 text-white/45">No projects found.</p>
              ) : (
                <div className="mt-10 grid gap-x-7 gap-y-12 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredProjects.map((project) => (
                    <div key={project.id} className="group text-left">
                      <GlassProjectFolder label={project.name} meta="Open project" onOpen={() => onOpenProject(project)} />
                      <div className="mt-4 flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-lg font-medium text-white/85">{project.name}</p>
                        <button
                          type="button"
                          aria-label={`Delete ${project.name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (window.confirm(`Delete "${project.name}"? This cannot be undone.`)) {
                              deleteMutation.mutate(project.id);
                            }
                          }}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/30 opacity-100 transition hover:bg-red-500/15 hover:text-red-300 sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <p className="mt-2 text-sm text-white/40">Created recently</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default function DashboardPage() {
  const [workspace, setWorkspace] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState<string>();
  const { createMutation } = useProjects();
  const { setActiveProject } = useAppStore();

  async function startBuilding(prompt: string) {
    const project = await createMutation.mutateAsync({
      name: projectNameFromPrompt(prompt),
      description: prompt,
    });
    if (project) {
      setInitialPrompt(prompt);
      setWorkspace(true);
    }
  }

  function openExistingProject(project: any) {
    setActiveProject(project);
    setInitialPrompt(undefined);
    setWorkspace(true);
  }

  return (
    <AuthGuard>
      {workspace ? (
        <AppShell
          initialPrompt={initialPrompt}
          onNewProject={() => {
            setWorkspace(false);
            setInitialPrompt(undefined);
          }}
          onBackToDashboard={() => {
            setWorkspace(false);
          }}
        />
      ) : (
        <DashboardHome onStart={startBuilding} onOpenProject={openExistingProject} />
      )}
    </AuthGuard>
  );
}
