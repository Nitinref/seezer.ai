"use client";

import { Deck } from "@/components/mcp/hairline/Deck";

const STEP = /^[-*] \[([ xX])\] /gm;

/** Browser-card view of checklist steps; completed work is filed back. */
export function PlanFigure({ plan }: { plan: string }) {
  const done = [...plan.matchAll(STEP)].map((step) => step[1] !== " ");
  if (!done.length) return null;

  const complete = done.filter(Boolean).length;
  return (
    <Deck
      done={done}
      label={`${complete} of ${done.length} ${done.length === 1 ? "step" : "steps"} built`}
      className="mx-auto aspect-[5/4] h-44 max-w-full sm:h-52"
    />
  );
}
