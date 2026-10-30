"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Folder,
  ChevronRight,
  LayoutGrid,
  Laptop,
  Loader2,
  LogOut,
  MessageCirclePlus,
  Moon,
  PanelLeftClose,
  Plus,
  Search,
  Settings,
  Sun,
  Trash2,
} from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { useAppStore } from "@/store/appStore";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { Project } from "@/types";
import { SizzerLogo } from "@/components/brand/SizzerLogo";
import { creditsApi } from "@/lib/api";

interface ProjectsSidebarProps {
  open: boolean;
  onToggle: () => void;
  onNewProject?: () => void;
  onBackToDashboard?: () => void;
}

export function ProjectsSidebar({
  open,
  onToggle,
  onNewProject,
  onBackToDashboard,
}: ProjectsSidebarProps) {
  const [search, setSearch] = useState("");
  const { projects, isLoading, deleteMutation } = useProjects();
  const { activeProject, setActiveProject } = useAppStore();
  const { user, logout } = useAuth();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"system" | "light" | "dark">(() => {
    const saved = typeof window === "undefined" ? null : window.localStorage.getItem("sizzer.theme");
    return saved === "system" || saved === "light" || saved === "dark" ? saved : "dark";
  });
  const [creditBalance, setCreditBalance] = useState(0);
  const [unlimitedCredits, setUnlimitedCredits] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadBalance = async () => {
      try {
        const credits = await creditsApi.balance();
        setUnlimitedCredits(credits.unlimited);
        if (credits.balanceUsd !== null) setCreditBalance(Number(credits.balanceUsd) || 0);
      } catch {
        // Keep the menu usable when the balance endpoint is unavailable.
      }
    };
    void loadBalance();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    root.classList.toggle("workspace-light", theme === "light");
  }, [theme]);

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountMenuOpen(false);
    };
    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const selectTheme = (nextTheme: "system" | "light" | "dark") => {
    const root = document.documentElement;
    if (nextTheme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", nextTheme);
    root.classList.toggle("workspace-light", nextTheme === "light");
    setTheme(nextTheme);
    window.localStorage.setItem("sizzer.theme", nextTheme);
  };

  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter((p: Project) => p.name.toLowerCase().includes(q));
  }, [projects, search]);

  const sidebarContent = (
    <div className="flex h-full w-[260px] flex-col justify-between bg-[#0e0f12] text-white">
      {/* Top Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.08] px-4 py-3.5">
        <SizzerLogo className="text-white" iconClassName="h-8 w-8" wordmarkClassName="text-[15px]" />
        <button
          type="button"
          onClick={onToggle}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          className="grid h-7 w-7 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/[0.08] hover:text-white"
        >
          <PanelLeftClose size={16} />
        </button>
      </div>

      {/* Action / Search / Projects Section */}
      <div className="flex min-h-0 flex-1 flex-col px-3 py-3">
        {/* New project button */}
        <button
          type="button"
          onClick={onNewProject}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] font-medium text-zinc-200 shadow-sm transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
        >
          <Plus size={15} className="text-sky-400" />
          <span>New project</span>
        </button>

        {/* Search input */}
        <div className="relative mt-2.5">
          <Search
            size={13}
            className="pointer-events-none absolute left-2.5 top-2.5 text-zinc-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] py-1.5 pl-8 pr-6 text-[12px] text-zinc-200 placeholder:text-zinc-500 outline-none transition focus:border-white/20 focus:bg-white/[0.05]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-2 text-[10px] text-zinc-500 hover:text-zinc-300"
            >
              ✕
            </button>
          )}
        </div>

        {/* Projects header */}
        <div className="mt-3 flex items-center justify-between px-1 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          <span>Your Projects</span>
          <span>{filteredProjects.length}</span>
        </div>

        {/* Projects list */}
        <div className="mt-1 flex-1 min-h-0 overflow-y-auto space-y-0.5 pr-0.5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-zinc-500">
              <Loader2 size={14} className="animate-spin text-sky-400" />
              <span>Loading projects...</span>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              {search ? "No matching projects" : "No projects yet"}
            </div>
          ) : (
            filteredProjects.map((project: Project) => {
              const isActive = activeProject?.id === project.id;
              return (
                <div
                  key={project.id}
                  onClick={() => setActiveProject(project)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setActiveProject(project);
                  }}
                  className={cn(
                    "group relative flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-all",
                    isActive
                      ? "border border-white/10 bg-white/[0.08] font-medium text-white shadow-sm"
                      : "border border-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                  )}
                >
                  <Folder
                    size={14}
                    className={cn(
                      "shrink-0 transition-colors",
                      isActive
                        ? "text-sky-400"
                        : "text-zinc-500 group-hover:text-zinc-300"
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{project.name}</span>
                  {isActive && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400 shadow-sm shadow-sky-400/50" />
                  )}
                  <button
                    type="button"
                    aria-label={`Delete ${project.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        window.confirm(
                          `Delete "${project.name}"? This cannot be undone.`
                        )
                      ) {
                        deleteMutation.mutate(project.id);
                      }
                    }}
                    className="hidden h-5 w-5 shrink-0 place-items-center rounded text-zinc-500 transition hover:bg-rose-500/20 hover:text-rose-300 group-hover:grid"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="shrink-0 border-t border-white/[0.08] px-3 py-3 space-y-1">
        {onBackToDashboard && (
          <button
            type="button"
            onClick={onBackToDashboard}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] text-zinc-400 transition hover:bg-white/[0.04] hover:text-zinc-200"
          >
            <LayoutGrid size={15} />
            <span>All projects</span>
          </button>
        )}

        <div ref={accountMenuRef} className="relative border-t border-white/[0.06] pt-2.5">
          {accountMenuOpen && (
            <div role="dialog" aria-label="Account menu" className="absolute bottom-[calc(100%+10px)] left-0 z-[60] w-full overflow-hidden rounded-xl border border-white/15 bg-[#0a0a0c] py-1.5 shadow-[0_16px_45px_rgba(0,0,0,0.65)]">
              <div className="flex items-center gap-2.5 px-3 pb-3 pt-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-white">{user?.name ?? "Sizzer User"}</p>
                  <p className="truncate text-[10.5px] text-zinc-500">{user?.email ?? "Signed in account"}</p>
                </div>
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-rose-300 via-orange-300 to-violet-600 text-[10px] font-bold text-white">{(user?.name ?? user?.email ?? "U").slice(0, 1).toUpperCase()}</div>
              </div>
              <div className="border-t border-white/10" />
              <div className="space-y-0.5 p-1.5 text-[12px]">
                <button type="button" className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-zinc-200 hover:bg-white/[0.08]"><span>Settings</span><Settings size={16} className="text-zinc-500" /></button>
                <button type="button" className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-zinc-200 hover:bg-white/[0.08]"><span>Credit</span><span className="text-zinc-500">{unlimitedCredits ? "Unlimited" : creditBalance.toFixed(2)}</span></button>
              </div>
              <div className="border-t border-white/10" />
              <div className="space-y-0.5 p-1.5 text-[12px]">
                <button type="button" className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-zinc-200 hover:bg-white/[0.08]"><span>Feedback</span><MessageCirclePlus size={16} className="text-zinc-500" /></button>
                <div className="flex items-center justify-between px-2.5 py-2 text-zinc-200"><span>Theme</span><div className="flex rounded-lg border border-white/15 bg-black p-0.5">{([["system", Laptop, "System"], ["light", Sun, "Light"], ["dark", Moon, "Dark"]] as const).map(([value, Icon, label]) => <button key={value} type="button" title={label} aria-label={label} onClick={() => selectTheme(value)} className={`grid h-5.5 w-5.5 place-items-center rounded-md ${theme === value ? "bg-white/15 text-white" : "text-zinc-500 hover:text-white"}`}><Icon size={13} /></button>)}</div></div>
                <button type="button" className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-zinc-200 hover:bg-white/[0.08]"><span>More</span><ChevronRight size={16} className="text-zinc-500" /></button>
              </div>
              <div className="border-t border-white/10" />
              <div className="p-1.5"><button type="button" onClick={logout} className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-zinc-200 hover:bg-white/[0.08]"><span>Sign Out</span><LogOut size={16} className="text-zinc-500" /></button></div>
            </div>
          )}
          <button type="button" onClick={() => setAccountMenuOpen((current) => !current)} aria-expanded={accountMenuOpen} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-white/[0.05]">
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 text-xs font-bold text-white shadow-sm">{(user?.name ?? user?.email ?? "U").slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0 flex-1 truncate"><p className="truncate text-[12px] font-medium text-zinc-200">{user?.name ?? "Sizzer User"}</p><p className="truncate text-[10.5px] text-zinc-400">{user?.email}</p></div>
            <LogOut size={13} className="shrink-0 text-zinc-500" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop collapsible sidebar */}
      <aside
        className={cn(
          "hidden md:block shrink-0 h-full border-r border-white/[0.08] transition-[width] duration-200 ease-in-out overflow-hidden",
          open ? "w-[260px]" : "w-0 border-r-0"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile drawer overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onToggle}
          />
          <div className="relative z-10 h-full w-[280px] shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

