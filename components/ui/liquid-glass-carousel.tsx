"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LiquidGlassCarouselItem {
  src: string;
  title: string;
  description?: string;
  number?: string;
}

export function LiquidGlassCarousel({ items, className }: { items: LiquidGlassCarouselItem[]; className?: string }) {
  const [active, setActive] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  function move(direction: number) {
    setActive((current) => (current + direction + items.length) % items.length);
  }

  useEffect(() => {
    const node = track.current?.children[active] as HTMLElement | undefined;
    node?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [active]);

  return <section className={cn("relative w-full", className)} aria-label="Project carousel">
    <div className="relative overflow-hidden rounded-[28px] border border-white/80 bg-white px-4 pb-7 pt-8 shadow-[0_30px_90px_rgba(0,0,0,.16)] sm:px-7">
      <h3 className="mb-8 text-center text-[18px] font-semibold text-[#111820]">{items[active]?.title ?? "Selected work"}</h3>
      <div ref={track} className="no-scrollbar relative flex h-[330px] snap-x snap-mandatory items-center gap-3 overflow-x-auto px-0 sm:h-[390px]">
        {items.map((item, index) => <button type="button" key={`${item.title}-${index}`} onClick={() => setActive(index)} className={cn("group relative h-[280px] min-w-[150px] snap-center overflow-hidden text-left transition duration-500 sm:h-[325px] sm:min-w-[190px]", active === index ? "z-10 scale-[1.04]" : "scale-95 opacity-80 hover:opacity-100")}><img src={item.src} alt={item.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" /><span className="absolute inset-x-3 bottom-3 truncate text-[12px] font-medium text-white drop-shadow-lg">{item.title}</span></button>)}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-[430px] w-[230px] -translate-x-1/2 -translate-y-1/2 rotate-[-18deg] rounded-[42%_58%_35%_65%] border-[3px] border-cyan-200/90 bg-gradient-to-br from-blue-950/55 via-blue-500/15 to-white/25 shadow-[0_0_12px_#00c8ff,0_0_45px_rgba(0,140,255,.85),inset_0_0_28px_rgba(255,255,255,.48)] backdrop-blur-[3px] sm:h-[520px] sm:w-[300px]" />
      </div>
      <div className="mt-5 flex items-center justify-center gap-3 text-[15px] font-semibold text-[#111820]"><span>{String(active + 1).padStart(2, "0")}</span><span className="text-[#a2a9ad]">/</span><span>{String(items.length).padStart(2, "0")}</span></div>
      <div className="mt-4 flex justify-center gap-2"><button type="button" aria-label="Previous card" onClick={() => move(-1)} className="grid h-9 w-9 place-items-center rounded-full border border-[#d5dde0] bg-white text-[#17202b] transition hover:bg-[#f1f7f9]"><ArrowLeft size={15} /></button><button type="button" aria-label="Next card" onClick={() => move(1)} className="grid h-9 w-9 place-items-center rounded-full border border-[#d5dde0] bg-white text-[#17202b] transition hover:bg-[#f1f7f9]"><ArrowRight size={15} /></button></div>
    </div>
  </section>;
}
