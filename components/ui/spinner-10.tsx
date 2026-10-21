"use client";

import { memo, useEffect, useId, useMemo, useState } from "react";
import { AnimatePresence, motion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/utils";

type TextMorphProps = { words: string[]; interval?: number; className?: string };

export function TextMorph({ words, interval = 2000, className }: TextMorphProps) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!words.length) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % words.length), interval);
    return () => clearInterval(timer);
  }, [words, interval]);

  const chars = useMemo(() => Array.from(words[index] ?? ""), [index, words]);
  if (!words.length) return null;
  return <AnimatePresence mode="popLayout"><motion.span key={index} className={cn("flex gap-[1px] overflow-hidden", className)} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.4 }}>{chars.map((char, charIndex) => <motion.span key={`${char}-${charIndex}`} className="inline-block" initial={{ opacity: 0, y: 5, filter: "blur(5px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -5, filter: "blur(5px)" }} transition={{ delay: charIndex * 0.03, duration: 0.3 }}>{char === " " ? "\u00A0" : char}</motion.span>)}</motion.span></AnimatePresence>;
}

interface LiquidWaveSpinnerProps extends HTMLMotionProps<"div"> { size?: "sm" | "md" | "lg"; hideText?: boolean }

const sizeConfig = {
  sm: { container: "gap-3", svgSize: 80, fontSize: "text-xs" },
  md: { container: "gap-6", svgSize: 120, fontSize: "text-sm" },
  lg: { container: "gap-8", svgSize: 180, fontSize: "text-base" },
} as const;
const WAVE_PATH = "M 0 36.5 C 67.43 36.5, 99.09 15.5, 160.53 15.5 C 221.98 15.5, 250.54 36.5, 300 36.5 C 348.56 36.5, 397.30 7, 457.63 7 C 517.96 7, 539.66 36.5, 600 36.5 C 667.43 36.5, 699.09 15.5, 760.53 15.5 C 821.98 15.5, 850.54 36.5, 900 36.5 C 948.56 36.5, 997.30 7, 1057.63 7 C 1117.96 7, 1139.66 36.5, 1200 36.5 L 1200 800 L 0 800 Z";

const LiquidWaveSpinner = memo(({ size = "md", hideText, className, ...props }: LiquidWaveSpinnerProps) => {
  const config = sizeConfig[size];
  const clipId = useId();
  const waveDuration = useMemo(() => 5.5 + Math.random() * 1.5, []);
  const backgroundDuration = useMemo(() => 3.5 + Math.random(), []);
  const foregroundDuration = useMemo(() => 2.5 + Math.random(), []);
  const waveDelay = useMemo(() => Math.random() * 0.5, []);
  return <motion.div className={cn("flex w-full flex-col items-center justify-center overflow-hidden rounded-b-lg", config.container, className)} {...props}>
    <svg viewBox="0 0 500 500" width={config.svgSize} height={config.svgSize} aria-hidden="true"><defs><clipPath id={clipId}><circle cx="249.5" cy="249.5" r="107.5" /></clipPath></defs><circle cx="249.5" cy="249.5" r="107.5" className="fill-white/10" /><g clipPath={`url(#${clipId})`}><motion.g initial={{ y: 330.6 }} animate={{ y: 170.1 }} transition={{ duration: waveDuration, delay: waveDelay, ease: "easeOut" }}><motion.g initial={{ x: -600 }} animate={{ x: 0 }} transition={{ duration: backgroundDuration, repeat: Infinity, ease: "linear" }}><path d={WAVE_PATH} className="fill-sky-400" opacity={0.4} /></motion.g></motion.g><motion.g initial={{ y: 330.6 }} animate={{ y: 180.1 }} transition={{ duration: waveDuration, delay: waveDelay, ease: "easeOut" }}><motion.g initial={{ x: 0 }} animate={{ x: -600 }} transition={{ duration: foregroundDuration, repeat: Infinity, ease: "linear" }}><path d={WAVE_PATH} className="fill-sky-300" /></motion.g></motion.g></g></svg>
    {!hideText && <div className="flex items-center gap-1 select-none text-white/60"><TextMorph words={["Loading assets ...", "Preparing animation ...", "Loading up preview ..."]} interval={2000} className={cn("font-medium", config.fontSize)} /></div>}
  </motion.div>;
});

LiquidWaveSpinner.displayName = "LiquidWaveSpinner";
export default LiquidWaveSpinner;
