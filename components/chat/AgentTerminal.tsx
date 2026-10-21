"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  BookOpen,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  Ellipsis,
  FileCode2,
  FilePlus2,
  Globe2,
  Loader2,
  Pencil,
  ShieldCheck,
  Sparkles,
  Terminal,
  Undo2,
} from "lucide-react";
import type { PipelineEvent } from "@/types";
import { cn } from "@/lib/utils";
import { CodeBlock, CodeBlockContent } from "@/components/ui/code-block";
import {
  Terminal as TerminalElement,
  TerminalContent,
  TerminalHeader,
  TerminalTitle,
} from "@/components/ai-elements/terminal";

type ActivityKind =
  | "tool"
  | "thought"
  | "agent_thought"
  | "transition"
  | "status"
  | "error"
  | "preview";

export type Activity = {
  event: PipelineEvent;
  title: string;
  displayTitle?: string;
  detail?: string;
  payload?: Record<string, unknown>;
  kind: ActivityKind;
};

function humanizeToolName(name: string) {
  const labels: Record<string, string> = {
    create_file: "Created project file",
    delete_file: "Removed file",
    delete_files: "Removed files",
    edit_files: "Updated project files",
    write_files: "Wrote project files",
    write_multiple_files: "Wrote project files",
    execute_command: "Executed shell command",
    execute: "Executed command",
    list_directory: "Checked project structure",
    read_file: "Read source file",
    read_multiple_files: "Read source files",
    save_context: "Used write plan",
    verify_project: "Verified project build",
  };
  return labels[name] ?? name.replaceAll("_", " ");
}

function cleanMessage(raw: string) {
  return raw
    .replace(/^📍\s*/, "")
    .replace(/^🔧 Calling tool:\s*/, "")
    .replace(/^[🤖⚡💡🔍]\s*/, "")
    .trim();
}

function toActivity(event: PipelineEvent): Activity | null {
  const message = event.message ?? "";

  if (event.stage === "start") {
    return {
      event,
      title: "Understanding your request",
      detail: "Request received",
      kind: "thought",
    };
  }

  if (event.stage === "planning") {
    const plan =
      event.plan && typeof event.plan === "object"
        ? (event.plan as Record<string, unknown>)
        : undefined;
    const title = message.includes("Build plan ready")
      ? "Writing the plan"
      : message.includes("Resuming from saved build plan")
        ? "Reading the saved plan"
        : "Choosing how to build it";
    return {
      event,
      title,
      detail: cleanMessage(message),
      payload: plan,
      kind: "thought",
    };
  }

  if (event.stage === "tool") {
    try {
      const value = JSON.parse(event.message ?? "{}");
      const title = String(value.kind ?? "tool");
      return {
        event,
        title,
        displayTitle: humanizeToolName(title),
        detail: value.phase ? String(value.phase) : "Tool",
        payload: value,
        kind: "tool",
      };
    } catch {
      return {
        event,
        title: "tool",
        displayTitle: "Executed tool",
        detail: event.message,
        kind: "tool",
      };
    }
  }

  if (event.stage === "preview") {
    return {
      event,
      title: cleanMessage(message),
      displayTitle: "Preview ready",
      kind: "preview",
    };
  }

  if (event.stage === "error") {
    return {
      event,
      title: message,
      displayTitle: cleanMessage(message),
      kind: "error",
    };
  }

  if (["planner", "builder", "validator", "checker"].includes(event.stage ?? "")) {
    if (message === "✅ Tool completed") return null;

    if (message.startsWith("🔧 Calling tool:")) {
      const title = message.replace("🔧 Calling tool: ", "").trim();
      return {
        event,
        title,
        displayTitle: humanizeToolName(title),
        detail: event.stage,
        kind: "tool",
      };
    }

    if (/LangGraph node\s*→\s*(agent|tools)/i.test(message)) {
      const displayTitle = message.includes("tools")
        ? "Selecting optimal tool"
        : "Analyzing next action";
      return {
        event,
        title: message,
        displayTitle,
        detail: event.stage,
        kind: "transition",
      };
    }

    const isReasoning = message.includes("🤖") || message.length > 30;
    const cleaned = cleanMessage(message);

    return {
      event,
      title: cleaned,
      displayTitle: cleaned,
      detail: event.stage,
      kind: isReasoning ? "agent_thought" : "status",
    };
  }

  return {
    event,
    title: cleanMessage(message),
    displayTitle: cleanMessage(message),
    detail: event.stage,
    kind: "status",
  };
}

function ActivityNodeMarker({ item, isRunning }: { item: Activity; isRunning?: boolean }) {
  if (isRunning) {
    return (
      <span className="absolute -left-[22px] top-1 flex h-[22px] w-[22px] items-center justify-center text-zinc-400">
        <Loader2 size={13} className="animate-spin" />
      </span>
    );
  }

  if (item.kind === "error") {
    return (
      <span className="absolute -left-[22px] top-1 flex h-[22px] w-[22px] items-center justify-center text-rose-400">
        <CircleAlert size={14} />
      </span>
    );
  }

  if (item.kind === "preview") {
    return (
      <span className="absolute -left-[22px] top-1 flex h-[22px] w-[22px] items-center justify-center text-zinc-400">
        <Globe2 size={14} />
      </span>
    );
  }

  if (item.kind === "agent_thought" || item.kind === "thought") {
    return (
      <span className="absolute -left-[22px] top-1 flex h-[22px] w-[22px] items-center justify-center text-zinc-400">
        <Sparkles size={14} />
      </span>
    );
  }

  if (item.kind === "tool") {
    const name = item.title.toLowerCase();
    if (name.includes("execute") || name.includes("cmd") || name.includes("command")) {
      return (
        <span className="absolute -left-[22px] top-1 flex h-[22px] w-[22px] items-center justify-center text-zinc-400">
          <Terminal size={14} />
        </span>
      );
    }
    return (
      <span className="absolute -left-[22px] top-1 flex h-[22px] w-[22px] items-center justify-center text-zinc-400">
        <FileCode2 size={14} />
      </span>
    );
  }

  if (item.kind === "transition") {
    return (
      <span className="absolute -left-[22px] top-1.5 flex h-[22px] w-[22px] items-center justify-center text-zinc-500">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
      </span>
    );
  }

  return (
    <span className="absolute -left-[22px] top-1 flex h-[22px] w-[22px] items-center justify-center text-zinc-400">
      <Check size={14} strokeWidth={2} />
    </span>
  );
}

function DiffViewer({ diff, fileName }: { diff: string; fileName?: string }) {
  const lines = diff.split("\n");
  return (
    <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-[#07080a]">
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[11px] font-mono text-zinc-400">
        <span>{fileName ?? "git diff"}</span>
        <span>{lines.length} lines</span>
      </div>
      <pre className="max-h-64 overflow-auto p-3 font-mono text-[11px] leading-5">
        {lines.map((line, index) => {
          const isAdd = line.startsWith("+") && !line.startsWith("+++");
          const isDel = line.startsWith("-") && !line.startsWith("---");
          const isHunk = line.startsWith("@@");
          return (
            <div
              key={index}
              className={cn(
                "flex px-1 rounded-sm",
                isAdd && "bg-emerald-500/15 text-emerald-300",
                isDel && "bg-rose-500/15 text-rose-300",
                isHunk && "text-sky-400/90 bg-sky-500/[0.05] font-semibold my-0.5",
                !isAdd && !isDel && !isHunk && "text-zinc-400"
              )}
            >
              <span className="w-6 shrink-0 select-none text-[10px] opacity-40">
                {index + 1}
              </span>
              <span className="whitespace-pre">{line || " "}</span>
            </div>
          );
        })}
      </pre>
    </div>
  );
}

function fileChangeStats(diff: string, file: string) {
  const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = diff.match(new RegExp(`---\\s+${escaped}([\\s\\S]*?)(?=\\n---\\s+|$)`))?.[1] ?? "";
  return {
    additions: (block.match(/^\+(?!\+)/gm) ?? []).length,
    deletions: (block.match(/^-(?!-)/gm) ?? []).length,
  };
}

function VerificationCard({ output, failed }: { output: string; failed: boolean }) {
  const [expanded, setExpanded] = useState(Boolean(output));
  return (
    <div className="w-full">
      <button type="button" onClick={() => setExpanded((value) => !value)} className="flex w-full items-center gap-2 px-0 py-1.5 text-left [&>span:nth-of-type(2)]:hidden">
        <ShieldCheck size={17} strokeWidth={1.6} className={failed ? "text-rose-400" : "text-zinc-400"} />
        <span className="text-[17px] font-medium tracking-[-0.02em] text-zinc-100">Checked the build</span>
        <span className="text-[16px] text-zinc-500">typecheck · build · no new migrations</span>
        <ChevronDown size={15} className={cn("ml-auto shrink-0 text-zinc-500 transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded && output && (
        <div className="mt-2 overflow-hidden rounded-[13px] border border-white/[0.12] bg-[#111214]">
          <CodeBlock size="sm" language="Shell" className="!rounded-none !border-0 !bg-transparent">
            <CodeBlockContent wrap className="max-h-[380px] !px-4 !py-3.5 !text-[14px] !leading-6">{output}</CodeBlockContent>
          </CodeBlock>
          <div className={cn("flex justify-between border-t border-white/[0.08] px-4 py-2.5 font-mono text-[13px]", failed ? "text-rose-400" : "text-zinc-400")}>
            <span>Database: no new migrations</span>
            <span className="flex items-center gap-1.5"><Check size={14} /> {failed ? "Failed" : "Success"}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function FlatFileChanges({
  files,
  additions,
  deletions,
  diff,
  created,
  fileChanges,
}: {
  files: string[];
  additions: number;
  deletions: number;
  diff: string;
  created: boolean;
  fileChanges: Map<string, { additions: number; deletions: number }>;
}) {
  return (
    <div className="space-y-1 py-0.5">
      {files.map((file) => {
        const stats = fileChangeStats(diff, file);
        const reported = fileChanges.get(file);
        const plus = stats.additions || reported?.additions || (files.length === 1 ? additions : 0);
        const minus = stats.deletions || reported?.deletions || (files.length === 1 ? deletions : 0);
        return (
          <div key={file} className="flex min-h-9 items-center gap-2.5 text-[16px] tracking-[-0.015em]">
            {created ? <FilePlus2 size={17} strokeWidth={1.55} className="shrink-0 text-zinc-400" /> : <Pencil size={17} strokeWidth={1.55} className="shrink-0 text-zinc-400" />}
            <span className="font-medium text-zinc-200">{created ? "Created" : "Edited"}</span>
            <span className="min-w-0 truncate border-b border-dotted border-zinc-600 pb-px text-zinc-400">{file}</span>
            {(plus > 0 || minus > 0) && <span className="shrink-0 font-mono text-[13px] tabular-nums"><span className="text-emerald-400">+{plus}</span><span className="ml-2 text-rose-400">-{minus}</span></span>}
          </div>
        );
      })}
    </div>
  );
}

function ReadFilesGroup({ items }: { items: Activity[] }) {
  const paths = items.flatMap((item) => {
    const payload = item.payload ?? {};
    const args = (payload.args ?? {}) as Record<string, unknown>;
    const candidate = args.path ?? args.file ?? args.file_path ?? payload.files;
    if (Array.isArray(candidate)) return candidate.map(String);
    return candidate ? [String(candidate)] : [];
  });
  const uniquePaths = [...new Set(paths)];

  return (
    <div className="space-y-1 py-0.5">
      {uniquePaths.map((path) => {
        const file = path.split("/").filter(Boolean).at(-1) ?? path;
        return (
          <div key={path} className="flex min-h-9 items-center gap-2.5 text-[16px] tracking-[-0.015em]">
            <BookOpen size={17} strokeWidth={1.55} className="shrink-0 text-zinc-400" />
            <span className="font-medium text-zinc-200">Read</span>
            <span title={path} className="min-w-0 truncate border-b border-dotted border-zinc-600 pb-px text-zinc-400">{file}</span>
          </div>
        );
      })}
    </div>
  );
}

function ActivityGroupHeader() {
  return (
    <div className="flex min-h-9 items-center gap-2.5 py-0.5 text-[16px] tracking-[-0.015em] text-zinc-400">
      <Terminal size={17} strokeWidth={1.55} className="shrink-0" />
      <span>Read files, edited files, ran commands</span>
      <ChevronDown size={15} className="text-zinc-500" />
    </div>
  );
}

/** Compact completion card shown below the final assistant summary. */
export function RunFileSummary({ events }: { events: PipelineEvent[] }) {
  const [showAll, setShowAll] = useState(false);
  const changes = useMemo(() => {
    const rows = new Map<string, { additions: number; deletions: number }>();
    for (const event of events) {
      if (event.stage !== "tool") continue;
      try {
        const payload = JSON.parse(event.message ?? "{}") as Record<string, unknown>;
        // Initial Vite/Tailwind scaffold files are setup, not the user's
        // completed implementation. Never present them as final edits.
        if (payload.phase === "scaffold") continue;
        const files = Array.isArray(payload.changed_files) ? payload.changed_files : Array.isArray(payload.files) ? payload.files : [];
        const reported = new Map<string, { additions: number; deletions: number }>();
        if (Array.isArray(payload.file_changes)) {
          payload.file_changes.forEach((change) => {
            if (!change || typeof change !== "object") return;
            const item = change as Record<string, unknown>;
            if (typeof item.path === "string") reported.set(item.path, { additions: Number(item.additions ?? 0), deletions: Number(item.deletions ?? 0) });
          });
        }
        files.forEach((raw) => {
          const path = String(raw);
          const stats = reported.get(path) ?? { additions: files.length === 1 ? Number(payload.additions ?? 0) : 0, deletions: files.length === 1 ? Number(payload.deletions ?? 0) : 0 };
          rows.set(path, stats);
        });
      } catch {}
    }
    return [...rows.entries()].map(([path, stats]) => ({ path, ...stats }));
  }, [events]);

  if (!changes.length) return null;
  const shown = showAll ? changes : changes.slice(0, 3);
  const additions = changes.reduce((sum, file) => sum + file.additions, 0);
  const deletions = changes.reduce((sum, file) => sum + file.deletions, 0);
  const hasCounts = additions > 0 || deletions > 0;

  return (
    <div className="mt-4 overflow-hidden rounded-[14px] border border-white/[0.11] bg-[#111214]">
      <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3.5">
        <div className="grid h-10 w-10 place-items-center rounded-[10px] bg-[#08090a] text-zinc-400"><FileCode2 size={17} strokeWidth={1.55} /></div>
        <div>
          <p className="text-[16px] font-medium text-zinc-100">Edited {changes.length} {changes.length === 1 ? "file" : "files"}</p>
          {hasCounts && <p className="mt-0.5 font-mono text-[12px]"><span className="text-emerald-400">+{additions}</span><span className="ml-2 text-rose-400">-{deletions}</span></p>}
        </div>
      </div>
      <div className="divide-y divide-white/[0.06]">
        {shown.map((file) => {
          const slash = file.path.lastIndexOf("/");
          return <div key={file.path} className="flex min-h-12 items-center gap-3 px-4 text-[15px]">
            <span className="min-w-0 flex-1 truncate"><span className="text-zinc-500">{slash >= 0 ? file.path.slice(0, slash + 1) : ""}</span><span className="text-zinc-200">{slash >= 0 ? file.path.slice(slash + 1) : file.path}</span></span>
            {(file.additions > 0 || file.deletions > 0) && <span className="shrink-0 font-mono text-[12px]"><span className="text-emerald-400">+{file.additions}</span><span className="ml-2 text-rose-400">-{file.deletions}</span></span>}
          </div>;
        })}
      </div>
      {changes.length > 3 && <button type="button" onClick={() => setShowAll((value) => !value)} className="flex w-full items-center gap-1 border-t border-white/[0.06] px-4 py-2.5 text-[14px] text-zinc-400 hover:text-zinc-200">{showAll ? "Show less" : `Show ${changes.length - 3} more files`} <ChevronDown size={14} className={cn(showAll && "rotate-180")} /></button>}
    </div>
  );
}

function SingleFileEditCard({
  file,
  additions,
  deletions,
  diff,
}: {
  file: string;
  additions: number;
  deletions: number;
  diff: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="overflow-hidden rounded-[13px] border border-white/[0.12] bg-[#101112] shadow-[0_12px_28px_rgba(0,0,0,.18)]">
      <button
        type="button"
        onClick={() => diff && setExpanded((value) => !value)}
        onMouseEnter={() => diff && setExpanded(true)}
        className="flex min-h-[49px] w-full items-center gap-2.5 px-3.5 text-left transition-colors hover:bg-white/[0.025]"
        aria-expanded={expanded}
      >
        <Pencil size={16} strokeWidth={1.55} className="shrink-0 text-zinc-400" />
        <span className="text-[16px] font-medium tracking-[-0.02em] text-zinc-100">Edited</span>
        <span className="min-w-0 truncate border-b border-dotted border-zinc-500 pb-px text-[15px] text-zinc-300">{file}</span>
        <span className="ml-1 shrink-0 font-mono text-[12px] tabular-nums"><span className="text-emerald-400">+{additions}</span><span className="ml-1.5 text-rose-400">-{deletions}</span></span>
        <ChevronDown size={15} className={cn("ml-auto shrink-0 text-zinc-500 transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded && diff && (
        <div className="border-t border-white/[0.08] p-3">
          <DiffViewer diff={diff} fileName={file} />
        </div>
      )}
    </div>
  );
}

function FileList({ files }: { files: string[] }) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? files : files.slice(0, 4);
  const hasMore = files.length > 4;

  return (
    <div className="divide-y divide-white/[0.055]">
      {displayed.map((file) => {
        const lastSlash = file.lastIndexOf("/");
        const dir = lastSlash !== -1 ? file.slice(0, lastSlash + 1) : "";
        const name = lastSlash !== -1 ? file.slice(lastSlash + 1) : file;

        return (
          <div
            key={file}
            className="flex min-h-[50px] items-center gap-3 px-3.5 text-[16px] font-sans tracking-[-0.012em] transition-colors hover:bg-white/[0.025]"
          >
            <div className="min-w-0 flex-1 truncate">
              <span className="text-zinc-500">{dir}</span>
              <span className="text-zinc-100">{name}</span>
            </div>
          </div>
        );
      })}

      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="flex w-full items-center justify-center gap-1.5 py-2 text-[12px] font-sans text-zinc-400 hover:bg-white/[0.025] hover:text-zinc-200 transition"
        >
          {showAll ? "Show less" : `+${files.length - 4} more files`}
        </button>
      )}
    </div>
  );
}

function CreatedFilesCard({ files }: { files: string[] }) {
  return (
    <div className="overflow-hidden rounded-[13px] border border-white/[0.11] bg-[#111214] shadow-[0_10px_26px_rgba(0,0,0,.14)]">
      <div className="flex min-h-[70px] items-center gap-4 border-b border-white/[0.08] px-4">
        <div className="grid h-11 w-11 place-items-center rounded-[10px] bg-[#08090a] text-zinc-400">
          <FilePlus2 size={18} strokeWidth={1.6} />
        </div>
        <span className="text-[18px] font-medium tracking-[-0.025em] text-zinc-100">Created {files.length} files</span>
      </div>
      <FileList files={files} />
    </div>
  );
}

function EditedFilesCard({
  files,
  additions,
  deletions,
  showDiff,
  onToggleDiff,
  diff,
}: {
  files: string[];
  additions: number;
  deletions: number;
  showDiff: boolean;
  onToggleDiff: () => void;
  diff: string;
}) {
  const [hoveredFile, setHoveredFile] = useState<string | null>(null);

  return (
    <div onMouseLeave={() => setHoveredFile(null)} className="relative overflow-visible rounded-[13px] border border-white/[0.11] bg-[#111214] shadow-[0_10px_26px_rgba(0,0,0,.14)]">
      <div className="flex min-h-[70px] items-center gap-4 border-b border-white/[0.08] px-4 py-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] bg-[#08090a] text-zinc-400">
          <FileCode2 size={17} strokeWidth={1.6} />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[18px] font-medium tracking-[-0.025em] text-zinc-100">Edited {files.length} {files.length === 1 ? "file" : "files"}</p>
          <p className="mt-1 font-mono text-[13px] tabular-nums">
            <span className="text-emerald-400">+{additions}</span>
            <span className="mx-2 text-zinc-600">·</span>
            <span className="text-rose-400">-{deletions}</span>
          </p>
        </div>
        <button type="button" className="hidden items-center gap-1.5 text-[13px] text-zinc-400 transition hover:text-zinc-100 sm:inline-flex">
          Undo <Undo2 size={14} />
        </button>
        {diff && (
          <button type="button" onClick={onToggleDiff} className="rounded-[11px] border border-white/[0.1] bg-white/[0.025] px-3 py-2 text-[13px] text-zinc-300 transition hover:bg-white/[0.08] hover:text-white">
            {showDiff ? "Hide changes" : "View changes"}
          </button>
        )}
      </div>
      <div className="divide-y divide-white/[0.055] overflow-hidden rounded-b-[13px]">
        {files.map((file) => {
          const slash = file.lastIndexOf("/");
          const stats = fileChangeStats(diff, file);
          return (
            <div
              key={file}
              onMouseEnter={() => diff && setHoveredFile(file)}
              className={cn(
                "flex min-h-[50px] items-center gap-3 px-4 text-[16px] tracking-[-0.012em] text-zinc-400 transition-colors",
                diff && "cursor-pointer hover:bg-white/[0.035] hover:text-zinc-200"
              )}
            >
              <span className="min-w-0 flex-1 truncate">
                {slash >= 0 && <span>{file.slice(0, slash + 1)}</span>}
                <span className="text-zinc-200">{file.slice(slash + 1)}</span>
              </span>
              {diff && <span className="shrink-0 font-mono text-[13px] tabular-nums"><span className="text-emerald-400">+{stats.additions}</span><span className="ml-2 text-rose-400">-{stats.deletions}</span></span>}
            </div>
          );
        })}
      </div>
      {showDiff && diff && <div className="border-t border-white/[0.07] bg-[#0b0d0f] p-3"><DiffViewer diff={diff} /></div>}
      {hoveredFile && diff && (
        <div className="absolute z-30 left-10 right-10 top-[76px] overflow-hidden rounded-[13px] border border-white/[0.13] bg-[#111214] shadow-[0_20px_50px_rgba(0,0,0,.58)]">
          <div className="flex h-11 items-center justify-between border-b border-white/[0.08] px-4 text-[14px] text-zinc-300">
            <span className="truncate">{hoveredFile}</span>
            <span className="ml-4 shrink-0 font-mono text-[11px]"><span className="text-emerald-400">+{additions}</span> <span className="text-rose-400">-{deletions}</span></span>
          </div>
          <DiffViewer diff={diff} />
        </div>
      )}
    </div>
  );
}

function ActivityRow({ item, isRunning }: { item: Activity; isRunning?: boolean }) {
  const [showDiff, setShowDiff] = useState(false);

  const payload = item.payload ?? {};
  const args = (payload.args ?? {}) as Record<string, unknown>;
  const command = String(args.command ?? args.cmd ?? "");
  const files = Array.isArray(payload.changed_files)
    ? payload.changed_files.map(String)
    : Array.isArray(payload.files)
      ? payload.files.map(String)
      : [];
  const commandNames = [
    "execute_command",
    "execute",
    "test_build",
    "verify_project",
  ];
  const isCommand = commandNames.includes(item.title);
  const isEdit =
    files.length > 0 &&
    [
      "edit_files",
      "write_files",
      "write_multiple_files",
      "create_file",
      "delete_file",
      "delete_files",
      "remove_file",
      "remove_files",
    ].includes(item.title);
  const isCreate =
    ["create_file", "write_multiple_files"].includes(item.title) &&
    !payload.changed_files;
  const diff = typeof payload.diff === "string" ? payload.diff : "";
  const fileChanges = new Map<string, { additions: number; deletions: number }>();
  if (Array.isArray(payload.file_changes)) {
    payload.file_changes.forEach((change) => {
      if (!change || typeof change !== "object") return;
      const value = change as Record<string, unknown>;
      if (typeof value.path !== "string") return;
      fileChanges.set(value.path, {
        additions: Number(value.additions ?? 0),
        deletions: Number(value.deletions ?? 0),
      });
    });
  }

  // 1. Architecture Plan Card
  if (item.kind === "thought" && payload.summary) {
    if (payload._fallback === true) {
      return <div className="py-1.5 text-[16px] leading-7 text-zinc-300">Planning the requested changes…</div>;
    }
    const steps = Array.isArray(payload.steps) ? payload.steps.map(String).filter(Boolean).slice(0, 6) : [];
    return (
      <div className="border-b border-white/[0.08] py-3 text-[16px] leading-7 tracking-[-0.015em] text-zinc-300">
        <p className="font-medium text-zinc-100">What you&apos;ll get</p>
        <p className="mt-2">{String(payload.summary)}</p>
        {steps.length > 0 && (
          <ul className="mt-3 list-disc space-y-1.5 pl-5 marker:text-zinc-500">
            {steps.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}
          </ul>
        )}
      </div>
    );
  }

  // 2. Shell Command Card
  if (isCommand) {
    const displayCommand =
      command ||
      (item.title === "test_build"
        ? "npm run build"
        : item.title === "verify_project"
          ? "npm run build && npm run lint --if-present"
          : item.title);
    const output = typeof payload.output === "string" ? payload.output : "";
    const exitCode =
      typeof payload.exit_code === "number"
        ? payload.exit_code
        : payload.success === false
          ? 1
          : typeof payload.lint_exit_code === "number"
          ? payload.lint_exit_code
          : typeof payload.build_exit_code === "number"
            ? payload.build_exit_code
            : payload.success === true
              ? 0
              : undefined;
    const isCommandRunning = isRunning && exitCode === undefined;
    const status = isCommandRunning
      ? "running"
      : exitCode !== undefined && exitCode !== 0
        ? "error"
        : undefined;
    const action = isCommandRunning ? "Running" : exitCode !== undefined && exitCode !== 0 ? "Failed" : "Ran";
    const terminalOutput = `$ ${displayCommand}${output ? `\n\n${output}` : ""}`;

    if (item.title === "verify_project") {
      return <VerificationCard output={output} failed={status === "error"} />;
    }

    return (
      <TerminalElement
        output={terminalOutput}
        isStreaming={isCommandRunning}
        autoScroll
        defaultExpanded={isCommandRunning}
        className={cn(status === "error" && "text-rose-300")}
      >
        <TerminalHeader>
          <TerminalTitle>
            <span className={cn("font-medium", status === "error" ? "text-rose-300" : "text-zinc-100")}>{action}</span>{" "}
            <span className="text-zinc-500">{displayCommand}</span>
          </TerminalTitle>
        </TerminalHeader>
        <TerminalContent
          className="!mt-2 !border-0 !bg-transparent !p-0"
          footer={exitCode !== undefined ? (
            <div className={cn("flex justify-end gap-1.5 border-t border-white/[0.08] px-4 py-2.5 text-[13px]", exitCode === 0 ? "text-zinc-400" : "text-rose-400")}>
              <Check size={14} /> {exitCode === 0 ? "Success" : `Exit code ${exitCode}`}
            </div>
          ) : undefined}
        />
      </TerminalElement>
    );
  }

  // 3. File Edits / Changes Card
  if (isEdit) {
    const additions = Number(payload.additions ?? 0);
    const deletions = Number(payload.deletions ?? 0);

    return (
      <FlatFileChanges files={files} additions={additions} deletions={deletions} diff={diff} created={isCreate} fileChanges={fileChanges} />
    );
  }

  // 4. Agent Reasoning / Thought
  if (item.kind === "agent_thought") {
    return (
      <div className="py-1.5">
        <p className="text-[16px] font-medium leading-7 tracking-[-0.015em] text-zinc-200 whitespace-pre-wrap">{item.title}</p>
      </div>
    );
  }

  // 5. Node Transition Step
  if (item.kind === "transition") {
    return (
      <div className="flex items-center gap-2 py-1 text-[14px] tracking-[-0.01em] text-zinc-500">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-500" />
        <span className="truncate">{item.displayTitle ?? item.title}</span>
      </div>
    );
  }

  // 6. Live Preview Step
  if (item.kind === "preview" || item.event.previewUrl) {
    const url = item.event.previewUrl;
    return (
      <div className="flex min-h-9 items-center gap-2.5 py-1 text-[16px] tracking-[-0.015em]">
        <Globe2 size={16} strokeWidth={1.6} className="shrink-0 text-zinc-400" />
        <span className="font-medium text-zinc-200">Preview ready</span>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-zinc-500 transition-colors hover:text-zinc-200">
            Open preview <ExternalLink size={13} />
          </a>
        )}
      </div>
    );
  }

  // 7. Standard Status / Progress Step
  return (
    <div className="flex items-start gap-2 py-1.5 text-[16px] tracking-[-0.015em]">
      {isRunning ? <Loader2 size={15} className="mt-1 shrink-0 animate-spin text-zinc-500" /> : <Check size={15} className="mt-1 shrink-0 text-zinc-500" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-[16px] leading-6",
                item.kind === "error"
                  ? "text-rose-300 font-medium"
                  : item.kind === "tool"
                    ? "font-medium text-zinc-100"
                    : "text-zinc-300"
              )}
            >
              {item.displayTitle ?? item.title}
            </span>
            {item.kind === "error" && item.detail && item.detail !== item.displayTitle && (
              <span className="hidden sm:inline font-mono text-[9px] text-zinc-400 uppercase tracking-[0.09em]">
                {item.detail}
              </span>
            )}
          </div>
        </div>
    </div>
  );
}

export function AgentTerminal({
  events,
}: {
  events: PipelineEvent[];
}) {
  const [expanded, setExpanded] = useState(
    () => !events.some((event) => event.stage === "done" || event.stage === "error")
  );
  const [now, setNow] = useState(() => Date.now());
  const wasActive = useRef(false);

  const activities = useMemo(() => {
    const result: Activity[] = [];
    const rawUpdates = events.filter(
      (e) => e.type === "pipeline_update" && !!e.stage
    );

    for (let i = 0; i < rawUpdates.length; i++) {
      const event = rawUpdates[i];
      const message = event.message ?? "";

      if (message === "✅ Tool completed") continue;

      // Deduplicate "Calling tool: X" when immediately followed by tool execution for X
      if (message.startsWith("🔧 Calling tool:")) {
        const toolName = message.replace("🔧 Calling tool: ", "").trim();
        const nextEvent = rawUpdates[i + 1];
        if (nextEvent && nextEvent.stage === "tool") {
          try {
            const parsed = JSON.parse(nextEvent.message ?? "{}");
            if (parsed.kind === toolName) {
              continue;
            }
          } catch {}
        }
      }

      const activity = toActivity(event);
      if (activity) {
        result.push(activity);
      }
    }

    return result;
  }, [events]);

  const failed = activities.some((item) => item.event.stage === "error");
  const active =
    activities.length > 0 &&
    !failed &&
    !activities.some((item) => item.event.stage === "done");
  useEffect(() => {
    if (wasActive.current && !active) setExpanded(false);
    wasActive.current = active;
  }, [active]);
  // Sandbox/checker chatter is useful to the worker, but it should not become
  // a user-facing transcript. The feed only contains the plan and actual work.
  const visibleActivities = activities.filter((item) => {
    if (["error", "thought", "preview"].includes(item.kind)) return true;
    if (item.kind !== "tool") return false;

    // Keep the transcript focused on work a person can inspect. Context reads,
    // agent hand-offs and repeated directory probes are implementation noise.
    return [
      "read_file",
      "read_multiple_files",
      "edit_files",
      "write_files",
      "write_multiple_files",
      "create_file",
      "delete_file",
      "delete_files",
      "remove_file",
      "remove_files",
      "execute_command",
      "execute",
      "test_build",
      "verify_project",
    ].includes(item.title);
  });
  const displayRows = useMemo(() => {
    const rows: Array<Activity | Activity[]> = [];
    for (let index = 0; index < visibleActivities.length;) {
      const item = visibleActivities[index];
      if (["read_file", "read_multiple_files"].includes(item.title)) {
        const reads: Activity[] = [];
        while (index < visibleActivities.length && ["read_file", "read_multiple_files"].includes(visibleActivities[index].title)) {
          reads.push(visibleActivities[index]);
          index += 1;
        }
        rows.push(reads);
      } else {
        rows.push(item);
        index += 1;
      }
    }
    return rows;
  }, [visibleActivities]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  if (!activities.length) return null;

  const first = activities[0].event.ts;
  const last = activities[activities.length - 1].event.ts;
  const seconds = Math.max(
    0,
    Math.round(((active ? now : last) - first) / 1000)
  );
  const latestActivity = activities.at(-1);
  const latestMessage = latestActivity?.event.message
    ?.replace(/^📍\s*/, "")
    .replace(/^🔧 Calling tool:\s*/, "");

  const latestToolName = latestActivity?.title.toLowerCase() ?? "";
  const activityTitle = failed
    ? "Build failed"
    : latestActivity?.kind === "tool"
      ? latestToolName.includes("execute") || latestToolName.includes("command")
        ? "Running a workspace command"
        : latestToolName.includes("read") || latestToolName.includes("list")
          ? "Reading project files"
          : "Updating project files"
      : latestActivity?.event.stage === "planning"
        ? "Choosing how to build it"
        : latestActivity?.event.stage === "building"
          ? "Building your project"
          : latestActivity?.event.stage === "validating"
            ? "Reviewing the code"
            : latestActivity?.event.stage === "checking"
              ? "Checking the production build"
              : latestActivity?.event.stage === "preview"
                ? "Preparing the preview"
                : latestActivity?.event.stage === "done"
                  ? "Workspace updated"
                  : latestActivity?.event.stage === "start"
                    ? "Understanding your request"
                  : latestActivity?.event.stage === "sandbox"
                    ? "Understanding your request"
                    : latestMessage ?? "Working on your request";

  const duration =
    seconds < 60
      ? `0:${String(seconds).padStart(2, "0")}`
      : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const logText = activities
    .map((item) => `${item.displayTitle ?? item.title}${item.detail ? ` · ${item.detail}` : ""}`)
    .join("\n");
  const runLabel = active ? activityTitle : failed ? "Build needs attention" : `Worked for ${duration}`;
  const firstToolRow = displayRows.findIndex((row) => Array.isArray(row) || row.kind === "tool");

  return (
    <section className="my-3 w-full min-w-0 text-left font-sans">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
        className="group flex min-h-10 w-full items-center gap-1.5 border-b border-white/[0.08] pb-2 text-left transition-colors hover:text-white"
      >
        {active && <Loader2 size={14} className="shrink-0 animate-spin text-zinc-500" />}
        {failed && <CircleAlert size={14} className="shrink-0 text-rose-400" />}
        <span className="min-w-0 flex-1 truncate text-[16px] tracking-[-0.018em] text-zinc-400 group-hover:text-zinc-200">
          {runLabel}
        </span>
        {active && <span className="shrink-0 font-mono text-[12px] text-zinc-500">{duration}</span>}
        {active ? (
          <Ellipsis size={17} className="shrink-0 text-zinc-500" />
        ) : (
          <ChevronRight size={15} className={cn("shrink-0 text-zinc-500 transition-transform", expanded && "rotate-90")} />
        )}
      </button>

      {expanded && (
        <div className="animate-in fade-in pt-2 duration-150 motion-reduce:animate-none">
          <div className="mt-1 space-y-1 pt-1">
            {displayRows.map((row, index) => {
              const isLastItem = index === displayRows.length - 1;
              if (Array.isArray(row)) {
                return (
                  <React.Fragment key={`read-files-${row[0]?.event.ts ?? index}`}>
                    {index === firstToolRow && <ActivityGroupHeader />}
                    <ReadFilesGroup items={row} />
                  </React.Fragment>
                );
              }
              return (
                <React.Fragment key={`${row.event.ts}-${index}`}>
                  {index === firstToolRow && <ActivityGroupHeader />}
                  <ActivityRow item={row} isRunning={active && isLastItem} />
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
