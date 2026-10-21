"use client";

import React from "react";
import { AlertCircle, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type TraceStatus = "running" | "error";

export function Trace({
  children,
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("w-full space-y-1", className)}>{children}</div>;
}

export function TraceCollapsible({
  children,
  defaultExpanded = false,
  isExpanded,
  onExpandedChange,
  className,
}: {
  children: React.ReactNode;
  defaultExpanded?: boolean;
  isExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  className?: string;
}) {
  return (
    <details
      // A browser renders its own "Details" label when a details element has
      // no usable summary. Trace always supplies a trigger; conceal malformed
      // fallback instances instead of leaking that browser-default label.
      className={cn("group/trace [&:not(:has(>summary))]:hidden", className)}
      open={isExpanded ?? (defaultExpanded || undefined)}
      onToggle={(event) => onExpandedChange?.(event.currentTarget.open)}
    >
      {children}
    </details>
  );
}

export function TraceCollapsibleTrigger({
  children,
  className,
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <summary
      className={cn(
        "flex cursor-pointer list-none items-center gap-2 py-1.5 text-left marker:hidden [&::-webkit-details-marker]:hidden",
        className
      )}
    >
      {children}
      <ChevronRight
        size={15}
        className="shrink-0 text-zinc-500 transition-transform group-open/trace:rotate-90"
      />
    </summary>
  );
}

export function TraceCollapsibleContent({
  children,
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mt-1 rounded-[12px] border border-white/[0.11] bg-[#111214] px-3 py-2", className)}>
      {children}
    </div>
  );
}

export function TraceLine({
  children,
  status,
  className,
}: React.HTMLAttributes<HTMLDivElement> & { status?: TraceStatus }) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 text-[17px] leading-7 tracking-[-0.018em] text-zinc-400",
        status === "running" && "text-zinc-300",
        status === "error" && "text-rose-300",
        className
      )}
    >
      {children}
    </div>
  );
}

export function TraceIcon({
  children,
  status,
  className,
}: React.HTMLAttributes<HTMLSpanElement> & { status?: TraceStatus }) {
  return (
    <span
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center text-zinc-400",
        status === "error" && "text-rose-400",
        status === "running" && "text-zinc-300",
        className
      )}
    >
      {status === "running" ? (
        <Loader2 size={14} className="animate-spin" />
      ) : status === "error" ? (
        <AlertCircle size={14} />
      ) : (
        children
      )}
    </span>
  );
}

export function TraceTitle({
  children,
  className,
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("min-w-0 truncate", className)}>{children}</span>
  );
}
