"use client";

import * as React from "react";
import { Check, Copy, TerminalIcon, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CodeBlock, CodeBlockContent } from "@/components/ui/code-block";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";

type TerminalContextValue = {
  output: string;
  isStreaming: boolean;
  autoScroll: boolean;
  onClear?: () => void;
};

const TerminalContext = React.createContext<TerminalContextValue | null>(null);

function useTerminal() {
  const context = React.useContext(TerminalContext);
  if (!context) throw new Error("Terminal parts must be rendered inside <Terminal>.");
  return context;
}

export type TerminalProps = React.HTMLAttributes<HTMLDivElement> & {
  output?: string;
  isStreaming?: boolean;
  autoScroll?: boolean;
  onClear?: () => void;
  defaultExpanded?: boolean;
  children: React.ReactNode;
};

export function Terminal({
  output = "",
  isStreaming = false,
  autoScroll = false,
  onClear,
  defaultExpanded = false,
  className,
  children,
  ...props
}: TerminalProps) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  React.useEffect(() => {
    if (isStreaming && output.length > 0) setExpanded(true);
  }, [isStreaming, output]);

  return (
    <TerminalContext.Provider value={{ output, isStreaming, autoScroll, onClear }}>
      <Trace className={className} {...props}>
        <TraceCollapsible isExpanded={expanded} onExpandedChange={setExpanded}>
          {children}
        </TraceCollapsible>
      </Trace>
    </TerminalContext.Provider>
  );
}

export type TerminalHeaderProps = React.HTMLAttributes<HTMLDivElement> & {
  actions?: React.ReactNode;
  status?: React.ReactNode;
};

export function TerminalHeader({ children, actions, status, className, ...props }: TerminalHeaderProps) {
  const { isStreaming } = useTerminal();
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)} {...props}>
      <TraceCollapsibleTrigger className="min-w-0 flex-1">
        <TraceLine status={isStreaming ? "running" : undefined}>{children}</TraceLine>
      </TraceCollapsibleTrigger>
      {status}
      {actions}
    </div>
  );
}

export type TerminalTitleProps = React.HTMLAttributes<HTMLSpanElement> & {
  title?: React.ReactNode;
};

export function TerminalTitle({ children, title, className, ...props }: TerminalTitleProps) {
  return (
    <>
      <TraceIcon><TerminalIcon size={14} /></TraceIcon>
      <TraceTitle className={className} {...props}>{title ?? children}</TraceTitle>
    </>
  );
}

export type TerminalContentProps = React.HTMLAttributes<HTMLDivElement> & {
  children?: React.ReactNode;
  footer?: React.ReactNode;
};

export function TerminalContent({ children, footer, className, ...props }: TerminalContentProps) {
  const { output, autoScroll } = useTerminal();
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const outputElement = contentRef.current?.querySelector("pre");
    if (autoScroll && outputElement) outputElement.scrollTop = outputElement.scrollHeight;
  }, [autoScroll, output]);

  return (
    <TraceCollapsibleContent className={className} {...props}>
      <div ref={contentRef} className={cn(footer && "overflow-hidden rounded-[13px] border border-white/[0.1] bg-[#111214]")}>
        <CodeBlock size="sm" language="Shell" code={output} className={cn(footer && "!rounded-none !border-0 !bg-transparent")}>
          <CodeBlockContent wrap className="max-h-64">
            {children ?? output}
          </CodeBlockContent>
        </CodeBlock>
        {footer}
      </div>
    </TraceCollapsibleContent>
  );
}

export function TerminalStatus({ className, children, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("shrink-0 font-mono text-[10px] uppercase tracking-[0.09em] text-zinc-500", className)} {...props}>{children}</span>;
}

export function TerminalActions({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex shrink-0 items-center gap-1", className)} {...props} />;
}

export function TerminalCopyButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { output } = useTerminal();
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      aria-label="Copy terminal output"
      className={cn("grid h-7 w-7 place-items-center rounded-md text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-100", className)}
      {...props}
      onClick={async (event) => {
        await navigator.clipboard?.writeText(output);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
        props.onClick?.(event);
      }}
    >
      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
    </button>
  );
}

export function TerminalClearButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { onClear } = useTerminal();
  if (!onClear) return null;
  return (
    <button
      type="button"
      aria-label="Clear terminal output"
      className={cn("grid h-7 w-7 place-items-center rounded-md text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-100", className)}
      {...props}
      onClick={(event) => {
        onClear();
        props.onClick?.(event);
      }}
    >
      <Trash2 size={14} />
    </button>
  );
}
