"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageContent } from "./MessageBubble";

const TECHNICAL = /^## How it will be built\s*$/m;

/** The product plan stays open; implementation details are available on demand. */
export function PlanText({ plan }: { plan: string }) {
  const [open, setOpen] = useState(false);
  const split = TECHNICAL.exec(plan);
  const product = split ? plan.slice(0, split.index) : plan;
  const technical = split ? plan.slice(split.index + split[0].length) : "";

  return (
    <div className="border-t border-white/[0.08] px-4 pb-4 pt-3">
      <MessageContent content={product} className="[&_h1]:hidden" />
      {technical.trim() && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 h-9 px-0 text-[13px] text-zinc-400 hover:bg-transparent hover:text-zinc-100"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
          >
            {open ? "Hide technical details" : "Technical details"}
          </Button>
          {open && (
            <MessageContent
              content={technical}
              className="mt-2 text-[13.5px] leading-6 text-zinc-400"
            />
          )}
        </>
      )}
    </div>
  );
}
