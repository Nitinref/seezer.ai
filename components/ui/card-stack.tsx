"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SquareArrowOutUpRight } from "lucide-react";
import Link from "next/link";

const cn = (...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(" ");

export type CardStackItem = { id: string | number; title: string; description?: string; imageSrc?: string; href?: string; ctaLabel?: string; tag?: string };
export type CardStackProps<T extends CardStackItem> = {
  items: T[]; initialIndex?: number; maxVisible?: number; cardWidth?: number; cardHeight?: number;
  overlap?: number; spreadDeg?: number; perspectivePx?: number; depthPx?: number; tiltXDeg?: number;
  activeLiftPx?: number; activeScale?: number; inactiveScale?: number; springStiffness?: number; springDamping?: number;
  loop?: boolean; autoAdvance?: boolean; intervalMs?: number; pauseOnHover?: boolean; showDots?: boolean; className?: string;
  onChangeIndex?: (index: number, item: T) => void; renderCard?: (item: T, state: { active: boolean }) => React.ReactNode;
};

function wrapIndex(n: number, len: number) { return len <= 0 ? 0 : ((n % len) + len) % len; }
function signedOffset(i: number, active: number, len: number, loop: boolean) {
  const raw = i - active;
  if (!loop || len <= 1) return raw;
  const alt = raw > 0 ? raw - len : raw + len;
  return Math.abs(alt) < Math.abs(raw) ? alt : raw;
}

export function CardStack<T extends CardStackItem>({
  items, initialIndex = 0, maxVisible = 7, cardWidth = 520, cardHeight = 320, overlap = 0.48,
  spreadDeg = 48, perspectivePx = 1100, depthPx = 140, tiltXDeg = 12, activeLiftPx = 22,
  activeScale = 1.03, inactiveScale = 0.94, springStiffness = 280, springDamping = 28,
  loop = true, autoAdvance = false, intervalMs = 2800, pauseOnHover = true, showDots = true,
  className, onChangeIndex, renderCard,
}: CardStackProps<T>) {
  const reduceMotion = useReducedMotion();
  const len = items.length;
  const [active, setActive] = React.useState(() => wrapIndex(initialIndex, len));
  const [hovering, setHovering] = React.useState(false);
  React.useEffect(() => setActive((current) => wrapIndex(current, len)), [len]);
  React.useEffect(() => { if (len) onChangeIndex?.(active, items[active]!); }, [active, items, len, onChangeIndex]);

  const maxOffset = Math.max(0, Math.floor(maxVisible / 2));
  const cardSpacing = Math.max(10, Math.round(cardWidth * (1 - overlap)));
  const stepDeg = maxOffset > 0 ? spreadDeg / maxOffset : 0;
  const canGoPrev = loop || active > 0;
  const canGoNext = loop || active < len - 1;
  const prev = React.useCallback(() => { if (len && canGoPrev) setActive((current) => wrapIndex(current - 1, len)); }, [canGoPrev, len]);
  const next = React.useCallback(() => { if (len && canGoNext) setActive((current) => wrapIndex(current + 1, len)); }, [canGoNext, len]);

  React.useEffect(() => {
    if (!autoAdvance || reduceMotion || !len || (pauseOnHover && hovering)) return;
    const id = window.setInterval(next, Math.max(700, intervalMs));
    return () => window.clearInterval(id);
  }, [autoAdvance, reduceMotion, len, pauseOnHover, hovering, intervalMs, next]);

  if (!len) return null;
  const activeItem = items[active]!;
  return <div className={cn("w-full", className)} onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
    <div className="relative w-full" style={{ height: Math.max(380, cardHeight + 80) }} tabIndex={0} onKeyDown={(event) => { if (event.key === "ArrowLeft") prev(); if (event.key === "ArrowRight") next(); }}>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto h-40 w-[76%] rounded-full bg-transparent" />
      <div className="absolute inset-0 flex items-end justify-center" style={{ perspective: `${perspectivePx}px` }}>
        <AnimatePresence initial={false}>
          {items.map((item, index) => {
            const offset = signedOffset(index, active, len, loop);
            const distance = Math.abs(offset);
            if (distance > maxOffset) return null;
            const isActive = offset === 0;
            const rotate = offset * stepDeg;
            const x = offset * cardSpacing;
            const y = distance * 10 + (isActive ? -activeLiftPx : 0);
            const scale = isActive ? activeScale : inactiveScale;
            return <motion.div key={item.id} className={cn("absolute bottom-0 overflow-hidden rounded-2xl border-4 border-white/10 shadow-2xl", isActive ? "cursor-grab active:cursor-grabbing" : "cursor-pointer")} style={{ width: "min(var(--card-width), calc(100vw - 32px))", maxWidth: cardWidth, height: cardHeight, zIndex: 100 - distance, transformStyle: "preserve-3d", ["--card-width" as string]: `${cardWidth}px` }} initial={reduceMotion ? false : { opacity: 0, y: y + 40, x, rotateZ: rotate, rotateX: isActive ? 0 : tiltXDeg, scale }} animate={{ opacity: 1, x, y, rotateZ: rotate, rotateX: isActive ? 0 : tiltXDeg, scale }} transition={{ type: "spring", stiffness: springStiffness, damping: springDamping }} onClick={() => setActive(index)} drag={isActive ? "x" : false} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.18} onDragEnd={(_event, info) => { if (reduceMotion) return; if (info.offset.x > Math.min(160, cardWidth * .22) || info.velocity.x > 650) prev(); else if (info.offset.x < -Math.min(160, cardWidth * .22) || info.velocity.x < -650) next(); }}>
              {renderCard ? renderCard(item, { active: isActive }) : <DefaultFanCard item={item} />}
            </motion.div>;
          })}
        </AnimatePresence>
      </div>
    </div>
    {showDots && <div className="mt-6 flex items-center justify-center gap-3"><div className="flex items-center gap-2">{items.map((item, index) => <button key={item.id} type="button" onClick={() => setActive(index)} className={cn("h-2 w-2 rounded-full transition", index === active ? "bg-foreground" : "bg-foreground/30 hover:bg-foreground/50")} aria-label={`Go to ${item.title}`} />)}</div>{activeItem.href && <Link href={activeItem.href} target="_blank" rel="noreferrer" aria-label="Open link" className="text-muted-foreground hover:text-foreground"><SquareArrowOutUpRight className="h-4 w-4" /></Link>}</div>}
  </div>;
}

function DefaultFanCard({ item }: { item: CardStackItem }) {
  return <div className="relative h-full w-full"><div className="absolute inset-0">{item.imageSrc ? <img src={item.imageSrc} alt={item.title} className="h-full w-full object-cover" draggable={false} /> : <div className="flex h-full w-full items-center justify-center bg-secondary text-sm text-muted-foreground">No image</div>}</div><div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" /><div className="relative z-10 flex h-full flex-col justify-end p-5"><div className="text-lg font-semibold text-white">{item.title}</div>{item.description && <div className="mt-1 text-sm text-white/80">{item.description}</div>}</div></div>;
}
