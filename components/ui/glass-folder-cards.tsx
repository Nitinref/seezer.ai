"use client";

import { ArrowUpRight, FileText, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

type GlassProjectFolderProps = { label: string; meta?: string; onOpen: () => void; className?: string };

export function GlassProjectFolder({ label, meta = "Ready to open", onOpen, className }: GlassProjectFolderProps) {
  return (
    <button type="button" onClick={onOpen} aria-label={`Open ${label}`} className={cn("group/folder relative block w-full text-left outline-none [perspective:900px]", className)}>
      <div className="relative aspect-[1.52] w-full transition-transform duration-500 ease-out group-hover/folder:-translate-y-2 group-focus-visible/folder:-translate-y-2">
        <div className="absolute inset-x-[5%] bottom-[8%] top-[8%] overflow-hidden rounded-[24px] border border-white/20 bg-[radial-gradient(circle_at_12%_0%,rgba(103,191,255,.8),transparent_34%),linear-gradient(125deg,#10233e_8%,#497da8_36%,#bdcadb_60%,#253b62_100%)] shadow-[0_22px_36px_-22px_rgba(0,0,0,.95)] transition-transform duration-500 group-hover/folder:-translate-y-3 group-hover/folder:rotate-[1deg]">
          <div className="absolute -left-5 top-[-14%] h-[66%] w-[56%] rotate-[-22deg] bg-white/20 blur-2xl" />
          <div className="absolute right-5 top-5 h-16 w-16 rounded-full bg-sky-200/25 blur-xl" />
        </div>
        <div className="absolute left-[11%] right-[11%] top-[27%] h-[54%] rounded-[22px] border border-white/30 bg-white/[0.13] shadow-[0_12px_22px_-16px_rgba(0,0,0,.8)] backdrop-blur-sm transition-all duration-500 group-hover/folder:top-[20%] group-hover/folder:rotate-[-2deg]" />
        <div className="absolute left-[8%] right-[8%] top-[32%] h-[52%] rounded-[22px] border border-white/35 bg-white/[0.2] shadow-[0_16px_28px_-16px_rgba(0,0,0,.8)] backdrop-blur-md transition-all duration-500 group-hover/folder:top-[16%] group-hover/folder:rotate-[2deg]">
          <div className="absolute left-5 right-5 top-4 flex items-center justify-between text-white/60 transition-opacity duration-300 group-hover/folder:opacity-100 sm:opacity-0"><span className="inline-flex items-center gap-1.5 text-xs font-medium"><FileText size={13} /> Project files</span><ArrowUpRight size={15} /></div>
        </div>
        <div className="absolute inset-x-0 bottom-0 top-[42%] rounded-[25px] border border-white/35 bg-[linear-gradient(180deg,rgba(255,255,255,.3),rgba(255,255,255,.12)_35%,rgba(255,255,255,.22))] shadow-[inset_0_1px_0_rgba(255,255,255,.55),0_20px_30px_-20px_rgba(0,0,0,.9)] backdrop-blur-xl transition-transform duration-500 ease-out [transform-origin:50%_100%] group-hover/folder:[transform:rotateX(18deg)] group-focus-visible/folder:[transform:rotateX(18deg)]">
          <div className="absolute left-6 right-6 top-7"><div className="flex items-center gap-2 text-white/90"><FolderOpen size={20} strokeWidth={1.7} /><span className="truncate text-[17px] font-semibold tracking-[-0.03em]">{label}</span></div><p className="mt-1.5 text-xs font-medium tracking-wide text-white/60">{meta}</p></div>
          <span className="absolute bottom-5 right-5 grid h-10 w-10 place-items-center rounded-2xl border border-white/35 bg-white/[0.16] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.36)] transition-transform duration-300 group-hover/folder:scale-110 group-hover/folder:bg-white/[0.25]"><ArrowUpRight size={18} /></span>
        </div>
      </div>
    </button>
  );
}

export default GlassProjectFolder;
