"use client";

import Link from "next/link";
import { ArrowUpRight, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { CardStack, type CardStackItem } from "@/components/ui/card-stack";
import { BlurredStagger } from "@/components/ui/blurred-stagger-text";
import { MorphingText } from "@/components/ui/morphing-text";
import { SizzerLogo } from "@/components/brand/SizzerLogo";
import { LiquidGlassButton } from "@/components/ui/liquid-glass-button";

const HERO = "/hero-balloon-meadow.png";
const NIGHT_HERO = "/hero-balloon-meadow-night.webp";

const CARD_ITEMS: CardStackItem[] = [
  { id: 1, title: "Describe it in plain words.", description: "No spec, no scaffolding, no setup screen to fill in first.", imageSrc: HERO, tag: "01" },
  { id: 2, title: "Read the plan, then it builds.", description: "See what you’ll get in your own words. Approve it, and Sizzer writes the screens, server, and database.", imageSrc: "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1000&q=85", tag: "02" },
  { id: 3, title: "Keep every line of it.", description: "Read each file, download the project, and run your AI-built website anywhere you like.", imageSrc: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=85", tag: "03" },
  { id: 4, title: "Test it in the browser.", description: "Sizzer checks each change so your pages work before you share them with the world.", imageSrc: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1000&q=85", tag: "04" },
  { id: 5, title: "Ship your next idea.", description: "Publish the finished website and keep improving it with plain-language prompts.", imageSrc: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1000&q=85", tag: "05" },
];

function WebsiteBuilderCard({ item, night = false }: { item: CardStackItem; night?: boolean }) {
  const imageFirst = item.id === 2;
  const image = <img src={item.imageSrc} alt="AI website builder preview" className="h-[46%] w-full object-cover" style={{ objectPosition: `${35 + Number(item.id) * 10}% center`, filter: `saturate(${0.92 + Number(item.id) * 0.025}) hue-rotate(${(Number(item.id) - 1) * 3}deg)` }} draggable={false} />;
  const copy = <div className="flex min-h-0 flex-1 flex-col justify-between p-6 text-left sm:p-7"><div className="flex items-center justify-between"><SizzerLogo compact iconClassName="h-7 w-7" /><span className={`text-xs tracking-[0.2em] ${night ? "text-sky-100/60" : "text-[#142332]"}`}>{item.tag}</span></div><div><h3 className={`max-w-[260px] text-[24px] leading-[1.05] tracking-[-0.04em] ${night ? "text-white" : "text-[#071b2e]"}`}>{item.title}</h3><p className={`mt-4 max-w-[290px] text-[15px] leading-6 ${night ? "text-slate-300" : "text-[#657889]"}`}>{item.description}</p></div></div>;
  return <div className={`flex h-full w-full flex-col overflow-hidden ${night ? "bg-[#102239]" : "bg-[#fffdf8]"}`}>{imageFirst ? <>{image}{copy}</> : <>{copy}{image}</>}</div>;
}

function Brand({ light = false }: { light?: boolean }) {
  return <SizzerLogo className={light ? "text-white" : "text-[#17202b]"} />;
}

function StartButton({ navbar = false }: { navbar?: boolean }) {
  const router = useRouter();
  const { token } = useAuthStore();
  const classes = navbar
    ? "min-h-[58px] border-white/45 bg-[#0e6398]/[0.52] px-6 py-3 text-[17px] shadow-[inset_0_1px_0_rgba(255,255,255,.3)] hover:bg-[#0e6398]/[0.64] max-md:min-h-[44px] max-md:gap-2 max-md:px-3 max-md:py-1.5 max-md:text-[12px]"
    : "border-white/35 bg-white/[0.08] px-7 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,.22)] hover:bg-white/[0.16]";
  return <button onClick={() => router.push(token ? "/dashboard" : "/signup")} className={`group inline-flex items-center gap-3 rounded-full border font-[family-name:var(--font-ui)] text-[16px] font-bold tracking-[-0.03em] text-white backdrop-blur-2xl backdrop-saturate-150 transition ${classes}`}><span>Start building</span><span className={`grid place-items-center rounded-full bg-white/15 transition group-hover:translate-x-0.5 ${navbar ? "h-10 w-10 max-md:h-6 max-md:w-6" : "h-8 w-8"}`}><ArrowUpRight size={17} /></span></button>;
}

export default function LandingPage() {
  const router = useRouter();
  const { token } = useAuthStore();
  const [night, setNight] = useState(false);

  useEffect(() => {
    // The landing page always opens in light mode. Night mode remains available
    // from the toggle, but a previously saved choice must not override the default.
    window.localStorage.setItem("sizzer-theme", "light");
    document.documentElement.classList.remove("dark");
    document.body.classList.remove("landing-night-active");
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", night);
    document.body.classList.toggle("landing-night-active", night);
  }, [night]);

  function toggleTheme() {
    setNight((current) => {
      const next = !current;
      window.localStorage.setItem("sizzer-theme", next ? "night" : "light");
      document.documentElement.classList.toggle("dark", next);
      document.body.classList.toggle("landing-night-active", next);
      return next;
    });
  }

  function begin() { router.push(token ? "/dashboard" : "/signup"); }
  const sceneImage = night ? NIGHT_HERO : HERO;

  return <main className={`landing-page min-h-screen overflow-hidden bg-[#fafbf8] text-[#17202b] ${night ? "landing-night" : ""}`}>
    <section className="relative min-h-screen overflow-hidden bg-[#28729a]">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: night ? `linear-gradient(180deg, rgba(2,10,35,.08), rgba(2,10,35,.03) 48%, rgba(2,8,20,.10)), url(${sceneImage})` : `linear-gradient(180deg, rgba(6,62,112,.30), rgba(14,93,145,.10) 48%, rgba(12,55,37,.08)), url(${sceneImage})` }} />
      <div className="relative z-10 mx-auto mt-5 flex w-[calc(100%-1.25rem)] max-w-[870px] items-center gap-2.5 md:mt-7 md:w-[calc(100%-2rem)]">
        <header className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-full border border-white/50 bg-[#126b9f]/[0.38] px-3.5 py-2.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.4),0_16px_40px_rgba(0,30,55,.24)] backdrop-blur-[32px] backdrop-saturate-150 md:gap-0 md:px-5">
          <SizzerLogo className="text-white" iconClassName="h-5 w-5 md:h-8 md:w-8" wordmarkClassName="text-[13px] md:text-[19px]" />
          <nav className="hidden items-center gap-8 font-[family-name:var(--font-ui)] text-[17px] font-bold tracking-[-0.04em] md:flex"><a className="transition hover:text-white/75" href="#how">How it works</a><a className="transition hover:text-white/75" href="#questions">Questions</a><Link className="transition hover:text-white/75" href="/login">Sign in</Link></nav>
          <StartButton navbar />
        </header>
        <LiquidGlassButton type="button" onClick={toggleTheme} aria-label={night ? "Switch to light mode" : "Switch to dark mode"} title={night ? "Light mode" : "Dark mode"} className="h-14 shrink-0 gap-2.5 px-6 font-[family-name:var(--font-ui)] text-base font-bold tracking-[-0.025em]">
          {night ? <Sun size={20} /> : <Moon size={20} />}
          {night ? "Light" : "Dark"}
        </LiquidGlassButton>
      </div>
      <div className="relative z-10 mx-auto flex w-full max-w-[56rem] flex-col items-center px-5 pb-24 pt-[6vh] text-center text-white md:pt-[6vh]">
        <h1 id="hero-heading" className="text-balance font-[family-name:var(--font-brand)] text-[clamp(50px,8vw,96px)] font-bold leading-[1.02] tracking-[-0.055em]"><span style={{ ["--i" as string]: 1 }} className="hero-line-rise block">Every app begins</span><em style={{ ["--i" as string]: 2 }} className="hero-line-rise block pb-1 font-semibold italic leading-[1.1]"><MorphingText texts={["as a sentence.", "as an idea.", "as a prompt."]} className="font-[family-name:var(--font-brand)]" /></em></h1>
        <p style={{ ["--i" as string]: 3 }} className="hero-line-rise mt-6 max-w-[40ch] text-pretty font-sans text-[17px] leading-[1.62] text-white/92 [text-shadow:0_1px_18px_rgb(10_30_50_/_0.45)] md:text-[18px]">Describe it in plain words. Sizzer plans it with you, then builds the full app, database included.</p>
        <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row"><StartButton /><button onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })} className="rounded-full bg-white px-9 py-4 text-[16px] font-medium text-[#17202b] transition hover:bg-white/90">See how it works</button></div>
      </div><div className="pointer-events-none absolute bottom-0 left-0 right-0 h-28 bg-[linear-gradient(to_bottom,transparent_0%,rgba(250,251,248,.48)_58%,#fafbf8_100%)] backdrop-blur-[2px]" />
    </section>

    <section id="how" className="mx-auto max-w-[965px] overflow-visible border-x border-[#dfe5e4] px-6 py-28 text-center md:py-36"><p className="relative z-10 mb-7 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#7a858a]">How it builds</p><h2 className="relative z-10 mx-auto max-w-4xl text-[clamp(36px,5vw,60px)] leading-[.94] tracking-[-0.065em]">Describe <BlurredStagger text={["a habit tracker", "an online store", "a portfolio site", "a SaaS product"]} repeat repeatDelay={3200} className="font-script inline-block italic text-sky-400" /><br />and keep every line it writes.</h2><div className="relative z-0 mx-auto mt-[-42px] max-w-[1100px] overflow-hidden"><img src={HERO} alt="Balloon meadow" className="h-[525px] w-full object-cover object-center" /><div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#fafbf8_0%,rgba(250,251,248,.88)_5%,transparent_18%,transparent_82%,rgba(250,251,248,.88)_95%,#fafbf8_100%)]" /><div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,#fafbf8_0%,transparent_12%,transparent_78%,rgba(250,251,248,.72)_96%,#fafbf8_100%)]" /></div><p className="relative z-10 mx-auto mt-[-2px] max-w-[440px] text-[16px] leading-7 text-[#768087]">Plain words in, a working app out: screens, a server, and a database that belong to you.</p></section>

    <section className="mx-auto max-w-[965px] border-x border-y border-[#dfe5e4] px-6 py-20 text-center"><p className="mx-auto max-w-[470px] text-[17px] leading-8 text-[#69747a]">Plain words in, a working app out: screens, a server and a real database. It checks each change in a browser before you see it.</p><div className="mt-16 border-t border-[#dfe5e4] pt-9"><p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#7a858a]">Any stack you name</p><div className="mt-5 flex flex-wrap justify-center gap-x-7 gap-y-3 text-[18px] text-[#747d82]"><span>React</span><span>Next.js</span><span>Vue</span><span>REST API</span><span>Django</span><span>Express</span><span>Postgres</span><span>MongoDB</span><span>and more</span></div><p className="mt-10 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#7a858a]">Coming next</p><div className="mt-5 flex flex-wrap justify-center gap-x-8 gap-y-3 text-[18px] text-[#747d82]"><span>Slide decks</span><span>PDFs</span><span>Reports</span><span>Documents</span></div></div></section>

    <section id="questions" className="border-y border-[#dfe5e4] bg-[#f7f8f5] px-6 py-28 md:py-36"><h2 className="mx-auto max-w-3xl text-center text-[clamp(44px,6vw,70px)] leading-[.95] tracking-[-0.065em]">From a sentence<br />to a running app.</h2><p className="mx-auto mt-6 max-w-xl text-center text-[16px] leading-7 text-[#69747a]">Sizzer is an AI website builder that turns your idea into a planned, working app—with the interface, backend, and database included.</p><div className="mx-auto mt-10 max-w-[1100px] px-2 py-8 sm:px-8"><CardStack items={CARD_ITEMS} initialIndex={1} autoAdvance intervalMs={3000} pauseOnHover showDots cardWidth={350} cardHeight={430} renderCard={(item) => <WebsiteBuilderCard item={item} />} /></div><div className="mt-16 flex justify-center"><button onClick={begin} className="group inline-flex items-center gap-3 rounded-full border border-[#b9c3c4] bg-white px-5 py-2.5 text-[14px] shadow-sm"><span>Start building</span><span className="grid h-7 w-7 place-items-center rounded-full bg-[#eef0ef] transition group-hover:translate-x-0.5"><ArrowUpRight size={15} /></span></button></div></section>

    <section className="relative min-h-[640px] overflow-hidden px-6 py-28 md:py-36"><div className="absolute inset-0 bg-cover bg-center saturate-[1.12] contrast-[1.04]" style={{ backgroundImage: `url(${HERO})` }} /><div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,#bae5fb_0%,#bae5fb_24%,rgba(157,214,244,.84)_36%,rgba(128,195,229,.42)_49%,rgba(14,73,70,.14)_68%,rgba(3,49,78,.25)_100%)]" /><div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(186,229,251,.14),transparent_20%,transparent_80%,rgba(186,229,251,.14))]" /><div className="pointer-events-none absolute inset-x-0 top-[48%] z-[1] select-none text-center text-[clamp(150px,25vw,380px)] font-extrabold leading-none tracking-[-0.04em] text-sky-950/40">sizzer</div><div className="relative z-10 mx-auto max-w-[900px]"><div className="flex flex-col justify-between gap-12 pt-12 md:flex-row"><div><Brand /><p className="mt-5 max-w-[220px] text-[15px] leading-6 text-[#69747a]">Describe an app. Keep every line of code.</p><p className="mt-10 text-[13px] text-[#69747a]">© 2026 Sizzer. All rights reserved.</p></div><div className="grid grid-cols-2 gap-x-12 gap-y-10 text-[14px] md:grid-cols-4"><div><p className="mb-4 font-semibold">Product</p><a className="block py-1.5 text-[#69747a]" href="#how">How it works</a><a className="block py-1.5 text-[#69747a]" href="#questions">Questions</a></div><div><p className="mb-4 font-semibold">Build</p><Link className="block py-1.5 text-[#69747a]" href="/signup">Start a project</Link><Link className="block py-1.5 text-[#69747a]" href="/dashboard">Your projects</Link></div><div><p className="mb-4 font-semibold">Account</p><Link className="block py-1.5 text-[#69747a]" href="/login">Sign in</Link><Link className="block py-1.5 text-[#69747a]" href="/signup">Create account</Link></div><div><p className="mb-4 font-semibold">More</p><a className="block py-1.5 text-[#69747a]" href="https://github.com/Nitinref/seezer.ai" target="_blank" rel="noreferrer">GitHub</a></div></div></div></div></section>
  </main>;
}

