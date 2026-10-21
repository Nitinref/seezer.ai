"use client";

import { useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type DeckProps = {
  /** A card is filed back once its matching plan step has completed. */
  done: boolean[];
  /** Accessible summary of the work represented by the tray. */
  label: string;
  className?: string;
};

const CARD_WIDTH = 118;
const CARD_HEIGHT = 78;
const CARD_GAP = 19;

/**
 * A pointer-driven tray of plan cards. It deliberately has no timer: the next
 * unfinished step receives the bright edge until a person explores a card.
 */
export function Deck({ done, label, className }: DeckProps) {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState<number | null>(null);
  const cards = done.slice(0, 8);
  const next = Math.max(0, cards.findIndex((built) => !built));
  const nextCard = next === -1 ? Math.max(0, cards.length - 1) : next;
  const height = Math.max(140, 104 + Math.max(0, cards.length - 1) * CARD_GAP);

  const positions = useMemo(
    () => cards.map((built, index) => {
      const selected = active === index;
      const focused = selected || (active === null && index === nextCard);
      const behind = active !== null && index < active;
      const ahead = active !== null && index > active;
      const rotation = selected ? 0 : behind || built ? -20 : ahead ? 12 : -7;
      const lift = selected ? -14 : focused ? -6 : 0;
      return { rotation, lift, focused };
    }),
    [active, cards, nextCard],
  );

  if (!cards.length) return null;

  return (
    <div
      data-hairline="deck"
      role="img"
      aria-label={label}
      className={cn("w-full select-none text-zinc-500", className)}
      onPointerLeave={() => setActive(null)}
    >
      <svg viewBox={`0 0 300 ${height}`} className="block h-auto w-full overflow-visible" aria-hidden="true">
        <path d={`M24 ${height - 30} H276 L262 ${height - 10} H38 Z`} fill="currentColor" fillOpacity="0.04" stroke="currentColor" strokeOpacity="0.32" />
        <path d={`M38 ${height - 30} H262`} fill="none" stroke="currentColor" strokeOpacity="0.42" />

        {cards.map((built, index) => {
          const pose = positions[index];
          const x = 91;
          const y = height - 38 - index * CARD_GAP + pose.lift;
          const highlighted = pose.focused;
          const transition = reduceMotion ? "none" : "transform 180ms cubic-bezier(.2,.8,.2,1), opacity 180ms ease";

          return (
            <g
              key={index}
              transform={`translate(${x} ${y}) rotate(${pose.rotation} ${CARD_WIDTH / 2} ${CARD_HEIGHT})`}
              style={{ transition, transformOrigin: `${x + CARD_WIDTH / 2}px ${y + CARD_HEIGHT}px`, cursor: "pointer" }}
              onPointerEnter={() => setActive(index)}
            >
              <rect x="3" y="4" width={CARD_WIDTH} height={CARD_HEIGHT} rx="8" fill="#08090a" stroke="currentColor" strokeOpacity="0.28" />
              <rect width={CARD_WIDTH} height={CARD_HEIGHT} rx="8" fill="#141517" stroke={highlighted ? "#e4e4e7" : "currentColor"} strokeOpacity={highlighted ? 0.85 : 0.52} />
              <path d={`M0 17 H${CARD_WIDTH}`} stroke={highlighted ? "#e4e4e7" : "currentColor"} strokeOpacity={highlighted ? 0.72 : 0.34} />
              {[13, 20, 27].map((dot) => <circle key={dot} cx={dot} cy="8.5" r="1.8" fill={highlighted ? "#e4e4e7" : "currentColor"} fillOpacity={highlighted ? 0.85 : 0.44} />)}
              {[34, 44, 54, 64].map((line, lineIndex) => <path key={line} d={`M14 ${line} H${lineIndex % 2 ? 76 : 101}`} stroke="currentColor" strokeOpacity={built ? 0.23 : 0.48} strokeWidth="2" strokeLinecap="round" />)}
              {built && <path d="M94 11 l4 4 8 -9" fill="none" stroke="#7dd3a7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
