"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type DiaTextRevealProps = {
  text: string | string[];
  className?: string;
  colors?: string[];
  repeat?: boolean;
  repeatDelay?: number;
  duration?: number;
  fixedWidth?: boolean;
};

export function DiaTextReveal({ text, className, repeat = false, repeatDelay = 1, duration = 1.1, fixedWidth = false }: DiaTextRevealProps) {
  const words = useMemo(() => (Array.isArray(text) ? text : [text]), [text]);
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const longest = fixedWidth ? words.reduce((max, word) => Math.max(max, word.length), 0) : undefined;

  useEffect(() => {
    if (!repeat || reduceMotion || words.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % words.length), (duration + repeatDelay) * 1000);
    return () => window.clearInterval(timer);
  }, [duration, reduceMotion, repeat, repeatDelay, words.length]);

  return <span className={cn("inline-block align-baseline whitespace-nowrap text-sky-400", className)} style={{ width: longest ? `${longest}ch` : undefined }}><motion.span key={`${words[index]}-${index}`} initial={reduceMotion ? false : { opacity: 0, clipPath: "inset(0 100% 0 0)" }} animate={{ opacity: 1, clipPath: "inset(0 0% 0 0)" }} transition={{ duration, ease: [0.23, 1, 0.32, 1] }} className="inline-block font-serif font-normal text-sky-400">{words[index]}</motion.span></span>;
}

export default DiaTextReveal;
