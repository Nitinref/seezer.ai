"use client";

import { useCallback, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

const morphTime = 1.5;
const cooldownTime = 0.5;

function useMorphingText(texts: string[]) {
  const textIndexRef = useRef(0);
  const morphRef = useRef(0);
  const cooldownRef = useRef(0);
  const timeRef = useRef(new Date());
  const text1Ref = useRef<HTMLSpanElement>(null);
  const text2Ref = useRef<HTMLSpanElement>(null);

  const setStyles = useCallback((fraction: number) => {
    const [current1, current2] = [text1Ref.current, text2Ref.current];
    if (!current1 || !current2) return;

    current2.style.filter = `blur(${Math.min(8 / fraction - 8, 100)}px)`;
    current2.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;
    const inverse = 1 - fraction;
    current1.style.filter = `blur(${Math.min(8 / inverse - 8, 100)}px)`;
    current1.style.opacity = `${Math.pow(inverse, 0.4) * 100}%`;
    current1.textContent = texts[textIndexRef.current % texts.length];
    current2.textContent = texts[(textIndexRef.current + 1) % texts.length];
  }, [texts]);

  const morph = useCallback(() => {
    morphRef.current -= cooldownRef.current;
    cooldownRef.current = 0;
    let fraction = morphRef.current / morphTime;
    if (fraction > 1) {
      cooldownRef.current = cooldownTime;
      fraction = 1;
    }
    setStyles(fraction);
    if (fraction === 1) textIndexRef.current++;
  }, [setStyles]);

  const cooldown = useCallback(() => {
    morphRef.current = 0;
    if (!text1Ref.current || !text2Ref.current) return;
    text2Ref.current.style.cssText = "filter:none;opacity:100%";
    text1Ref.current.style.cssText = "filter:none;opacity:0%";
  }, []);

  useEffect(() => {
    let frame: number;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const now = new Date();
      const elapsed = (now.getTime() - timeRef.current.getTime()) / 1000;
      timeRef.current = now;
      cooldownRef.current -= elapsed;
      if (cooldownRef.current <= 0) morph(); else cooldown();
    };
    animate();
    return () => cancelAnimationFrame(frame);
  }, [cooldown, morph]);

  return { text1Ref, text2Ref };
}

export function MorphingText({ texts, className }: { texts: string[]; className?: string }) {
  const { text1Ref, text2Ref } = useMorphingText(texts);
  return <div className={cn("relative mx-auto h-[1.05em] w-full text-center [filter:url(#morphing-text-threshold)_blur(0.6px)]", className)}>
    <span className="absolute inset-x-0 top-0 inline-block w-full" ref={text1Ref} />
    <span className="absolute inset-x-0 top-0 inline-block w-full" ref={text2Ref} />
    <svg className="hidden" aria-hidden="true">
      <defs>
        <filter id="morphing-text-threshold">
          <feColorMatrix
            in="SourceGraphic"
            type="matrix"
            values="1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 255 -140"
          />
        </filter>
      </defs>
    </svg>
  </div>;
}
