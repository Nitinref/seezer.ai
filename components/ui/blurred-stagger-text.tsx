"use client";

import * as React from "react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

export function BlurredStagger({ text = "we love hextaui.com ❤️", className = "text-base", repeat = false, repeatDelay = 2800 }: { text: string | string[]; className?: string; repeat?: boolean; repeatDelay?: number }) {
  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.015 } } };
  const letterAnimation = { hidden: { opacity: 0, filter: "blur(10px)" }, show: { opacity: 1, filter: "blur(0px)" } };
  const texts = Array.isArray(text) ? text : [text];
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (!repeat || texts.length < 2) return;
    const timer = window.setInterval(() => setCycle((current) => current + 1), repeatDelay);
    return () => window.clearInterval(timer);
  }, [repeat, repeatDelay, texts.length]);

  const activeText = texts[cycle % texts.length];
  return <motion.span key={cycle} variants={container} initial="hidden" animate="show" className={className} aria-label={activeText}>
    {activeText.split("").map((char, index) => <motion.span key={`${char}-${index}`} variants={letterAnimation} transition={{ duration: 0.3 }}>{char === " " ? "\u00A0" : char}</motion.span>)}
  </motion.span>;
}

export default BlurredStagger;
