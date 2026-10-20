"use client";

import React, { useMemo, useState } from "react";
import { BrainCircuit, Check, ChevronDown, ChevronRight, CircleAlert, Copy, FileCode2, Globe2, Search, TerminalSquare, Wrench } from "lucide-react";
import type { PipelineEvent, TokenSummary } from "@/types";
import { cn } from "@/lib/utils";

type Activity = { event: PipelineEvent; title: string; displayTitle?: string; detail?: string; payload?: Record<string, unknown>; kind: "agent" | "thought" | "tool" | "status" | "error" | "preview" };

function json(value: unknown) { try { return JSON.stringify(value); } catch { return String(value); } }

function humanizeToolName(name: string) {
  const labels: Record<string, string> = {
    create_file: "Created a file",
    delete_file: "Removed a file",
    edit_files: "Updated project files",
    execute_command: "Ran a command",
    list_directory: "Checked project files",
    read_file: "Read a project file",
    read_multiple_files: "Read project files",
    verify_project: "Verified the project",
    write_multiple_files: "Wrote project files",
  };
  return labels[name] ?? name.replaceAll("_", " ");
}

function toolActivity(event: PipelineEvent): Activity {
  try {
    const value = JSON.parse(event.message ?? "{}");
    const detail = [value.args, value.changed_files, value.files, value.success].filter((item) => item !== undefined).map(json).join("  ");
    const title = String(value.kind ?? "tool");
    return { event, title, displayTitle: humanizeToolName(title), detail, payload: value, kind: "tool" };
  } catch { return { event, title: "tool", detail: event.message, kind: "tool" }; }
}

function toActivity(event: PipelineEvent): Activity | null {
  const message = event.message ?? "";
  if (event.stage === "planning") {
    const plan = event.plan && typeof event.plan === "object" ? event.plan as Record<string, unknown> : undefined;
    return { event, title: message, detail: event.stage, payload: plan, kind: "thought" };
  }
  if (event.stage === "tool") return toolActivity(event);
  if (event.stage === "preview") return { event, title: message, kind: "preview" };
  if (event.stage === "error") return { event, title: message, kind: "error" };
  if (["planner", "builder", "validator", "checker"].includes(event.stage ?? "")) {
    if (message === "✅ Tool completed") return null;
    if (message.startsWith("🔧 Calling tool:")) {
      const title = message.replace("🔧 Calling tool: ", "");
      return { event, title, displayTitle: humanizeToolName(title), detail: event.stage, kind: "tool" };
    }
    const title = message.replace(/^📍\s*/, "");
    const displayTitle = title
      .replace(/LangGraph node\s*→\s*agent/i, "Considering the next step")
      .replace(/LangGraph node\s*→\s*tools/i, "Choosing the right tool");
    return { event, title, displayTitle, detail: event.stage, kind: event.stage === "planner" ? "thought" : "agent" };
  }
  return { event, title: message, detail: event.stage, kind: "status" };
}

function ActivityIcon({ item }: { item: Activity }) {
  const props = { size: 15, strokeWidth: 1.8 };
  if (item.kind === "error") return <CircleAlert {...props} className="text-red-400" />;
  if (item.kind === "preview") return <Globe2 {...props} className="text-sky-300" />;
  if (item.kind === "tool") {
    const name = item.title.toLowerCase();
    if (name.includes("read") || name.includes("list") || name.includes("search")) return <Search {...props} className="text-white/55" />;
    if (name.includes("write") || name.includes("edit") || name.includes("create")) return <FileCode2 {...props} className="text-white/55" />;
    if (name.includes("execute") || name.includes("verify") || name.includes("test")) return <TerminalSquare {...props} className="text-white/55" />;
    return <Wrench {...props} className="text-white/55" />;
  }
  if (item.kind === "thought") return <BrainCircuit {...props} className="text-sky-300/70" />;
  if (item.kind === "agent") return <BrainCircuit {...props} className="text-white/55" />;
  return <Check {...props} className="text-white/50" />;
}

export function AgentTerminal({ events, tokens }: { events: PipelineEvent[]; tokens?: TokenSummary }) {
  const [expanded, setExpanded] = useState(false);
  const activities = useMemo(() => events.filter((event) => event.type === "pipeline_update").map(toActivity).filter(Boolean) as Activity[], [events]);
  if (!activities.length) return null;

  const first = activities[0].event.ts;
  const last = activities[activities.length - 1].event.ts;
  const failed = activities.some((item) => item.event.stage === "error");
  const active = !failed && !activities.some((item) => item.event.stage === "done");
  const seconds = Math.max(0, Math.round((last - first) / 1000));
  const outputTokens = tokens?.total?.output;
  const latestActivity = activities.at(-1);
  const latestMessage = latestActivity?.event.message
    ?.replace(/^📍\s*/, "")
    .replace(/^🔧 Calling tool:\s*/, "");
  const progressMessage = latestActivity?.kind === "tool"
    ? latestActivity.title.includes("read")
      ? "I’m reviewing your project files."
      : latestActivity.title.includes("execute") || latestActivity.title.includes("verify")
        ? "I’m running checks on your project."
        : "I’m writing and updating your project files."
    : latestActivity?.event.stage === "checking"
      ? "I’m checking that your app builds and runs correctly."
      : latestActivity?.event.stage === "planning"
        ? "I’m planning the structure of your app."
        : latestMessage;
  const assistantMessage = failed
    ? "The build ran into an issue. Open the activity details to see what happened."
    : active
      ? progressMessage
        ?.replace(/LangGraph node\s*→\s*agent/i, "I’m working through the next step.")
        .replace(/LangGraph node\s*→\s*tools/i, "I’m selecting the right tool for the job.")
        ?? "I’m working on your app now."
      : "Your app is built. I’ve finished the available checks.";
  const duration = seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

  return (
    <section className="mx-1 font-sans tracking-[-0.01em]">
      <div className="flex items-start gap-3">
        <div className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-sky-300/20 bg-sky-400/10">
          <BrainCircuit size={15} className={active ? "text-sky-300 animate-pulse" : "text-sky-300"} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("text-[15px] leading-7", failed ? "text-red-300" : "text-white/80")}>
            {assistantMessage}
          </p>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
            className="mt-2 flex w-full items-center gap-2 border-t border-white/[0.08] py-3 text-left text-[13px] text-white/50 transition hover:text-white/80"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>{active ? `Build activity · ${activities.length} updates` : `Completed in ${duration}`}</span>
            {outputTokens !== undefined && <span className="text-emerald-300/80">+{outputTokens.toLocaleString()} tokens</span>}
          </button>
          {expanded && <div className="ml-1 border-l border-white/[0.1] pl-4">
            {activities.map((item, index) => <ActivityRow key={`${item.event.ts}-${index}`} item={item} />)}
            {active && <div className="mt-2 flex items-center gap-2 py-1 text-[13px] text-white/40">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-300" />
              Working on your app…
            </div>}
          </div>}
        </div>
      </div>
    </section>
  );
}

function ActivityRow({ item }: { item: Activity }) {
  const [showDiff, setShowDiff] = useState(false);
  const [copied, setCopied] = useState(false);
  const payload = item.payload ?? {};
  const args = (payload.args ?? {}) as Record<string, unknown>;
  const command = String(args.command ?? args.cmd ?? "");
  const files = Array.isArray(payload.changed_files)
    ? payload.changed_files.map(String)
    : Array.isArray(payload.files) ? payload.files.map(String) : [];
  const isCommand = item.title === "execute_command" || item.title === "execute";
  const isDelete = ["delete_file", "delete_files", "remove_file", "remove_files"].includes(item.title);
  const isEdit = files.length > 0 && ["edit_files", "write_files", "write_multiple_files", "create_file", "delete_file", "delete_files", "remove_file", "remove_files"].includes(item.title);
  const isCreate = ["create_file", "write_multiple_files"].includes(item.title) && !payload.changed_files;
  const diff = typeof payload.diff === "string" ? payload.diff : "";

  if (item.kind === "thought" && payload.summary) {
    const steps = Array.isArray(payload.steps) ? payload.steps.map(String) : [];
    const approach = typeof payload.approach === "string" ? payload.approach : "";
    return <div className="rounded-xl border border-white/[0.08] bg-[#0d0e10] px-4 py-4 text-[15px] leading-7 text-white/75">
      <p className="mb-3 font-medium text-white/90">{String(payload.summary)}</p>
      {approach && <p className="mb-3 text-white/60">{approach}</p>}
      {steps.length > 0 && <ul className="space-y-1.5 pl-5">
        {steps.map((step, index) => <li key={`${step}-${index}`} className="list-disc">{step}</li>)}
      </ul>}
    </div>;
  }

  async function copyCommand() {
    if (!command) return;
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  if (isCommand) return <div className="py-2">
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#242424] text-left">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5 text-[13px] text-white/70"><span className="text-white/45">&lt;/&gt;</span><span>powershell</span><button className="ml-auto text-white/45 hover:text-white" onClick={copyCommand}>{copied ? <Check size={16} /> : <Copy size={16} />}</button></div>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-[14px] leading-6 text-white/75"><span className="text-orange-300">{command.split(" ")[0]}</span>{command.slice(command.split(" ")[0].length)}</pre>
    </div>
  </div>;

  if (isEdit) return <div className="py-2">
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#171919]">
      <div className="flex items-center gap-3 px-4 py-3"><FileCode2 size={19} className={isDelete ? "text-red-400" : "text-white/55"} /><div><div className={cn("font-semibold", isDelete ? "text-red-300" : "text-white/70")}>{isDelete ? "Deleted" : isCreate ? "Created" : "Edited"} {files.length} file{files.length === 1 ? "" : "s"}</div><div className="text-[12px]"><span className="text-emerald-400">+{String(payload.additions ?? 0)}</span> <span className="text-red-400">-{String(payload.deletions ?? 0)}</span></div></div><button onClick={() => setShowDiff((value) => !value)} className="ml-auto rounded-lg border border-white/15 px-3 py-1.5 text-[12px] text-white/65 hover:bg-white/10">{showDiff ? "Hide changes" : "View changes"}</button></div>
      <div className="border-t border-white/[0.06] px-4">{files.map((file) => <div key={file} className="truncate border-b border-white/[0.05] py-2 text-[13px] text-white/50">{file}</div>)}</div>
      {showDiff && diff && <pre className="max-h-72 overflow-auto border-t border-white/10 bg-[#050505] p-3 font-mono text-[12px] leading-6">{diff.split("\n").map((line, index) => <span key={index} className={cn("block whitespace-pre", line.startsWith("+") && !line.startsWith("+++") && "text-emerald-400", line.startsWith("-") && !line.startsWith("---") && "text-red-400", line.startsWith("@@") && "text-sky-300", !line.startsWith("+") && !line.startsWith("-") && !line.startsWith("@@") && "text-white/60")}>{line || " "}</span>)}</pre>}
    </div>
  </div>;

  return <div className="group flex gap-2 py-1.5 text-[15px] leading-7">
          <div className="mt-0.5 shrink-0"><ActivityIcon item={item} /></div>
          <div className={item.kind === "error" ? "min-w-0 text-red-300" : "min-w-0 text-white/65"} title={item.detail}>
            <div className="truncate">{item.displayTitle ?? item.title}</div>
            {item.event.previewUrl && <a href={item.event.previewUrl} target="_blank" rel="noreferrer" className="block text-[13px] text-sky-300 hover:text-sky-200">Open preview</a>}
          </div>
        </div>;
}
