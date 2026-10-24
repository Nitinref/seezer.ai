"use client";

import { Github, Star } from "lucide-react";
import { useEffect, useState } from "react";

const REPOSITORY_URL = "https://github.com/Nitinref/seezer.ai";

function formatStars(count: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(count);
}

export function GitHubStarButton() {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function loadStars() {
      try {
        const response = await fetch("/api/github-stars");
        const data = (await response.json()) as { stars?: number | null };
        if (active && typeof data.stars === "number") setStars(data.stars);
      } catch {
        // The link remains useful even if GitHub is temporarily unavailable.
      }
    }

    void loadStars();
    const refresh = window.setInterval(loadStars, 60_000);
    return () => {
      active = false;
      window.clearInterval(refresh);
    };
  }, []);

  return (
    <a
      href={REPOSITORY_URL}
      target="_blank"
      rel="noreferrer"
      aria-label={stars === null ? "Star Sizzer on GitHub" : `Star Sizzer on GitHub, ${stars} stars`}
      className="group inline-flex items-center overflow-hidden rounded-full border border-white/35 bg-slate-950/25 text-[15px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.2)] backdrop-blur-xl transition hover:border-white/60 hover:bg-slate-950/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      <span className="inline-flex items-center gap-2 px-4 py-3">
        <Github size={18} aria-hidden="true" />
        <span>Star on GitHub</span>
      </span>
      <span className="inline-flex min-w-12 items-center justify-center gap-1 border-l border-white/25 bg-white/10 px-3 py-3 tabular-nums transition group-hover:bg-white/15">
        <Star size={15} className="fill-current" aria-hidden="true" />
        {stars === null ? <span aria-hidden="true">—</span> : formatStars(stars)}
      </span>
    </a>
  );
}
