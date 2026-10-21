"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be unavailable in embedded previews.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="grid h-7 w-7 place-items-center rounded-md text-zinc-500 transition hover:bg-white/[0.07] hover:text-zinc-100"
      aria-label="Copy code"
      title={copied ? "Copied" : "Copy output"}
    >
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={15} />}
    </button>
  );
}

export function CodeBlock({
  children,
  size = "default",
  className,
  language,
  code,
}: React.HTMLAttributes<HTMLDivElement> & {
  size?: "sm" | "default";
  language?: string;
  code?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[13px] border border-white/[0.1] bg-[#111214] text-zinc-100",
        size === "sm" && "rounded-xl",
        className
      )}
    >
      {(language || code) && (
        <div className="flex items-center justify-between border-b border-white/[0.07] bg-white/[0.025] px-3 py-2">
          <span className="text-[15px] tracking-[-0.01em] text-zinc-500">
            {language || "code"}
          </span>
          {code && <CopyButton value={code} />}
        </div>
      )}
      {children}
    </div>
  );
}

export function CodeBlockContent({
  children,
  wrap = false,
  className,
}: React.HTMLAttributes<HTMLPreElement> & { wrap?: boolean }) {
  return (
    <pre
      className={cn(
        "max-h-64 overflow-auto p-4 font-mono text-[15px] leading-7",
        className,
        wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
      )}
    >
      {children}
    </pre>
  );
}
