"use client";

import { Children, createContext, useCallback, useContext, useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

type SequenceContextValue = {
  completeItem: (index: number) => void;
  activeIndex: number;
};

const SequenceContext = createContext<SequenceContextValue>({
  completeItem: () => undefined,
  activeIndex: 0,
});
const ItemIndexContext = createContext(0);

function useTurn() {
  const { activeIndex, completeItem } = useContext(SequenceContext);
  const itemIndex = useContext(ItemIndexContext);
  return { started: activeIndex >= itemIndex, itemIndex, completeItem };
}

/** A line which reveals once the preceding terminal line has completed. */
export function AnimatedSpan({ children, className }: { children: React.ReactNode; className?: string }) {
  const { started, itemIndex, completeItem } = useTurn();
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: reduceMotion ? 0 : -5 }}
      animate={started ? { opacity: 1, y: 0 } : { opacity: 0, y: reduceMotion ? 0 : -5 }}
      transition={{ duration: reduceMotion ? 0 : 0.3 }}
      className={cn("grid text-sm font-normal tracking-tight", className)}
      onAnimationComplete={() => completeItem(itemIndex)}
    >
      {children}
    </motion.div>
  );
}

/** Types a single terminal line after its turn begins. */
export function TypingAnimation({
  children,
  className,
  duration = 18,
}: {
  children: string;
  className?: string;
  duration?: number;
}) {
  const [displayedText, setDisplayedText] = useState("");
  const { started, itemIndex, completeItem } = useTurn();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!started) return;
    if (reduceMotion) {
      setDisplayedText(children);
      completeItem(itemIndex);
      return;
    }

    setDisplayedText("");
    let index = 0;
    const typing = window.setInterval(() => {
      if (index < children.length) {
        setDisplayedText(children.slice(0, index + 1));
        index += 1;
      } else {
        window.clearInterval(typing);
        completeItem(itemIndex);
      }
    }, duration);
    return () => window.clearInterval(typing);
  }, [children, duration, started, itemIndex, completeItem, reduceMotion]);

  return <span className={cn("text-sm font-normal tracking-tight", className)}>{displayedText}</span>;
}

/**
 * A self-contained terminal sequence. Children should be AnimatedSpan and/or
 * TypingAnimation. The sequence progresses only after each line finishes.
 */
export function Terminal({ children, className }: { children: React.ReactNode; className?: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const completeItem = useCallback(
    (index: number) => setActiveIndex((current) => (index === current ? current + 1 : current)),
    [],
  );

  return (
    <SequenceContext.Provider value={{ completeItem, activeIndex }}>
      <div className={cn("h-full w-full overflow-hidden rounded-[10px] border border-white/[0.12] bg-[#111214] font-mono", className)}>
        <div className="flex gap-1.5 border-b border-white/[0.08] p-4">
          {[0, 1, 2].map((dot) => <span key={dot} className="size-2 rounded-full bg-zinc-500/50" />)}
        </div>
        <pre className="overflow-auto p-4 whitespace-pre-wrap [overflow-wrap:anywhere]">
          <code className="grid gap-y-1 text-[12.5px] text-zinc-300">
            {Children.toArray(children).map((child, index) => (
              <ItemIndexContext.Provider key={index} value={index}>{child}</ItemIndexContext.Provider>
            ))}
          </code>
        </pre>
      </div>
    </SequenceContext.Provider>
  );
}
