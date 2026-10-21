"use client";
import React from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/types";
import { CopyButton } from "./CopyButton";
import { CodeListing } from "./CodeListing";

function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="font-semibold text-zinc-50">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} className="rounded-md bg-white/[0.08] px-1.5 py-0.5 font-mono text-[.86em] text-zinc-200">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

function renderTextBlock(text: string, key: string) {
  const lines = text.replace(/\\r\\n?/g, "\n").trim().split("\n");
  const nodes: React.ReactNode[] = [];
  let bullets: string[] = [];
  let numbered: string[] = [];

  const flushBullets = () => {
    if (!bullets.length) return;
    nodes.push(
      <ul key={`${key}-bullets-${nodes.length}`} className="my-4 list-disc space-y-2.5 pl-7 marker:text-zinc-500">
        {bullets.map((bullet, index) => <li key={index} className="pl-0.5">{renderInline(bullet)}</li>)}
      </ul>
    );
    bullets = [];
  };

  const flushNumbered = () => {
    if (!numbered.length) return;
    nodes.push(
      <ol key={`${key}-numbered-${nodes.length}`} className="my-4 list-decimal space-y-2.5 pl-7 marker:text-zinc-500">
        {numbered.map((item, index) => <li key={index} className="pl-1">{renderInline(item)}</li>)}
      </ol>
    );
    numbered = [];
  };

  lines.forEach((line, index) => {
    const bullet = line.match(/^\s*[-*]\s+(.+)/);
    if (bullet) {
      flushNumbered();
      bullets.push(bullet[1]);
      return;
    }
    const numberedItem = line.match(/^\s*\d+[.)]\s+(.+)/);
    if (numberedItem) {
      flushBullets();
      numbered.push(numberedItem[1]);
      return;
    }
    flushBullets();
    flushNumbered();
    const heading = line.match(/^#{1,3}\s+(.+)/) ?? line.match(/^\*\*([^*]+)\*\*$/);
    if (heading) {
      nodes.push(<h3 key={`${key}-heading-${index}`} className="mb-4 mt-1 text-[19px] font-semibold leading-7 tracking-[-0.025em] text-white">{heading[1]}</h3>);
    } else if (line.trim()) {
      nodes.push(<p key={`${key}-line-${index}`} className="mb-3">{renderInline(line)}</p>);
    }
  });
  flushBullets();
  flushNumbered();
  return nodes;
}

function renderAssistantContent(content: string) {
  const chunks = content.split(/```([\w+#.-]*)\n?([\s\S]*?)```/g);
  const nodes: React.ReactNode[] = [];

  for (let index = 0; index < chunks.length; index += 3) {
    const text = chunks[index];
    if (text) {
      nodes.push(
        <React.Fragment key={`text-${index}`}>{renderTextBlock(text, `text-${index}`)}</React.Fragment>,
      );
    }
    const language = chunks[index + 1];
    const code = chunks[index + 2];
    if (code !== undefined) {
      const cleanCode = code.replace(/^\n/, "").replace(/\n$/, "");
      nodes.push(
        <CodeListing
          key={`code-${index}`}
          language={language || "code"}
          value={cleanCode}
        />,
      );
    }
  }

  return nodes;
}

/** Reusable rich markdown content for plans, summaries, and assistant messages. */
export function MessageContent({ content, className }: { content: string; className?: string }) {
  return <div className={cn("min-w-0", className)}>{renderAssistantContent(content)}</div>;
}

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  if (message.role === "assistant") {
    return (
      <article className="w-full min-w-0 px-1 py-2 font-sans text-[17px] leading-[1.72] tracking-[-0.018em] text-zinc-100">
        <MessageContent content={message.content} />
        {message.metadata?.previewUrl && (
          <a
            href={message.metadata.previewUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-[13px] text-zinc-400 transition-colors hover:text-zinc-200"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open Preview
          </a>
        )}
      </article>
    );
  }

  return (
    <div className={cn("flex flex-col gap-0.5", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "w-fit max-w-[min(80%,56ch)] wrap-anywhere whitespace-pre-wrap rounded-[16px_16px_6px_16px] px-4 py-3 font-sans text-[14.5px] leading-[1.7] tracking-[-0.005em]",
          isUser
            ? "bg-sky-500 text-white shadow-[0_8px_24px_rgba(14,165,233,.14)]"
            : "rounded-bl-md border border-white/[0.08] bg-[#1c1d1f] text-white/80"
        )}
      >
        {message.content}
        {message.metadata?.previewUrl && (
          <a
            href={message.metadata.previewUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 mt-2 text-gray-600 hover:text-gray-900 transition-colors text-[11px]"
          >
            <ExternalLink className="w-3 h-3" />
            Open Preview
          </a>
        )}
      </div>
      {isUser && <CopyButton text={message.content} label="Copy message" />}
    </div>
  );
}
