"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { CardStack, type CardStackItem } from "@/components/ui/card-stack";
import { BlurredStagger } from "@/components/ui/blurred-stagger-text";

const HERO = "/hero-balloon-meadow.png";

const CARD_ITEMS: CardStackItem[] = [
  { id: 1, title: "Describe it in plain words.", description: "No spec, no scaffolding, no setup screen to fill in first.", imageSrc: HERO, tag: "01" },
  { id: 2, title: "Read the plan, then it builds.", description: "See what you’ll get in your own words. Approve it, and Sizzer writes the screens, server, and database.", imageSrc: "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1000&q=85", tag: "02" },
  { id: 3, title: "Keep every line of it.", description: "Read each file, download the project, and run your AI-built website anywhere you like.", imageSrc: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=85", tag: "03" },
  { id: 4, title: "Test it in the browser.", description: "Sizzer checks each change so your pages work before you share them with the world.", imageSrc: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1000&q=85", tag: "04" },
  { id: 5, title: "Ship your next idea.", description: "Publish the finished website and keep improving it with plain-language prompts.", imageSrc: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1000&q=85", tag: "05" },
];

function WebsiteBuilderCard({ item }: { item: CardStackItem }) {
  const imageFirst = item.id === 2;
  const image = <img src={item.imageSrc} alt="AI website builder preview" className="h-[46%] w-full object-cover" style={{ objectPosition: `${35 + Number(item.id) * 10}% center`, filter: `saturate(${0.92 + Number(item.id) * 0.025}) hue-rotate(${(Number(item.id) - 1) * 3}deg)` }} draggable={false} />;
  const copy = <div className="flex min-h-0 flex-1 flex-col justify-between p-6 text-left sm:p-7"><div className="flex items-center justify-between"><span className="grid h-7 w-7 place-items-center rounded-full border-2 border-[#142332] text-sm font-bold text-[#142332]">c</span><span className="text-xs tracking-[0.2em] text-[#142332]">{item.tag}</span></div><div><h3 className="max-w-[260px] text-[24px] leading-[1.05] tracking-[-0.04em] text-[#071b2e]">{item.title}</h3><p className="mt-4 max-w-[290px] text-[15px] leading-6 text-[#657889]">{item.description}</p></div></div>;
  return <div className="flex h-full w-full flex-col overflow-hidden bg-[#fffdf8]">{imageFirst ? <>{image}{copy}</> : <>{copy}{image}</>}</div>;
}

function Brand({ light = false }: { light?: boolean }) {
  return <span className={`flex items-center gap-2 text-[18px] font-semibold tracking-[-0.04em] ${light ? "text-white" : "text-[#17202b]"}`}><span className="grid h-7 w-7 place-items-center rounded-full border-2 border-current text-[15px] font-bold">c</span>sizzer</span>;
}

function StartButton() {
  const router = useRouter();
  const { token } = useAuthStore();
  return <button onClick={() => router.push(token ? "/dashboard" : "/signup")} className="group inline-flex items-center gap-3 rounded-full border border-white/45 bg-white/[0.16] px-7 py-3.5 font-sans text-[16px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,.28)] backdrop-blur-2xl backdrop-saturate-150 transition hover:bg-white/[0.24]"><span>Start building</span><span className="grid h-8 w-8 place-items-center rounded-full bg-white/15 transition group-hover:translate-x-0.5"><ArrowUpRight size={17} /></span></button>;
}

export default function LandingPage() {
  const router = useRouter();
  const { token } = useAuthStore();
  function begin() { router.push(token ? "/dashboard" : "/signup"); }

  return <main className="min-h-screen overflow-hidden bg-[#fafbf8] text-[#17202b]">
    <section className="relative min-h-screen overflow-hidden bg-[#28729a]">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `linear-gradient(180deg, rgba(14,74,107,.35), rgba(12,66,84,.18) 48%, rgba(12,55,37,.25)), url(${HERO})` }} />
      <header className="relative z-10 mx-auto flex max-w-[760px] items-center justify-between rounded-full border border-white/45 bg-white/[0.14] px-5 py-2.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.32),0_16px_40px_rgba(0,30,55,.18)] backdrop-blur-2xl backdrop-saturate-150 md:mt-7">
        <Brand light /><nav className="hidden items-center gap-7 font-sans text-[14px] md:flex"><a href="#how">How it works</a><a href="#questions">Questions</a><Link href="/login">Sign in</Link></nav><StartButton />
      </header>
      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-5 pb-24 pt-24 text-center text-white md:pt-28">
        <h1 className="max-w-4xl font-serif text-[clamp(52px,8vw,104px)] leading-[.9] tracking-[-0.06em]">Describe your idea<br /><em className="font-serif font-normal">and watch it become a real app.</em></h1>
        <p className="mt-9 max-w-[520px] text-[17px] leading-7 text-white/85">Describe it in plain words. Sizzer plans it with you, then builds the full app, database included.</p>
        <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row"><StartButton /><button onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })} className="rounded-full bg-white px-9 py-4 text-[16px] font-medium text-[#17202b] transition hover:bg-white/90">See how it works</button></div>
      </div><div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/10 to-transparent" />
    </section>

    <section id="how" className="mx-auto max-w-[965px] overflow-visible px-6 py-28 text-center md:py-36"><p className="relative z-10 mb-7 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#7a858a]">How it builds</p><h2 className="relative z-10 mx-auto max-w-4xl text-[clamp(44px,7vw,78px)] leading-[.94] tracking-[-0.065em]">Describe <BlurredStagger text={["a habit tracker", "an online store", "a portfolio site", "a SaaS product"]} repeat repeatDelay={3200} className="font-script inline-block italic text-sky-400" /><br />and keep every line it writes.</h2><div className="relative z-0 mx-auto mt-[-42px] max-w-[1100px] overflow-hidden"><img src={HERO} alt="Balloon meadow" className="h-[525px] w-full object-cover object-center" /><div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#fafbf8_0%,rgba(250,251,248,.88)_5%,transparent_18%,transparent_82%,rgba(250,251,248,.88)_95%,#fafbf8_100%)]" /><div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,#fafbf8_0%,transparent_12%,transparent_78%,rgba(250,251,248,.72)_96%,#fafbf8_100%)]" /></div><p className="relative z-10 mx-auto mt-[-2px] max-w-[440px] text-[16px] leading-7 text-[#768087]">Plain words in, a working app out: screens, a server, and a database that belong to you.</p></section>

    <section className="mx-auto max-w-[965px] border-y border-[#dfe5e4] px-6 py-20 text-center"><p className="mx-auto max-w-[470px] text-[17px] leading-8 text-[#69747a]">Plain words in, a working app out: screens, a server and a real database. It checks each change in a browser before you see it.</p><div className="mt-16 border-t border-[#dfe5e4] pt-9"><p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#7a858a]">Any stack you name</p><div className="mt-5 flex flex-wrap justify-center gap-x-7 gap-y-3 text-[18px] text-[#747d82]"><span>React</span><span>Next.js</span><span>Vue</span><span>REST API</span><span>Django</span><span>Express</span><span>Postgres</span><span>MongoDB</span><span>and more</span></div><p className="mt-10 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#7a858a]">Coming next</p><div className="mt-5 flex flex-wrap justify-center gap-x-8 gap-y-3 text-[18px] text-[#747d82]"><span>Slide decks</span><span>PDFs</span><span>Reports</span><span>Documents</span></div></div></section>

    <section id="questions" className="border-y border-[#dfe5e4] bg-[#f7f8f5] px-6 py-28 md:py-36"><h2 className="mx-auto max-w-3xl text-center text-[clamp(44px,6vw,70px)] leading-[.95] tracking-[-0.065em]">From a sentence<br />to a running app.</h2><p className="mx-auto mt-6 max-w-xl text-center text-[16px] leading-7 text-[#69747a]">Sizzer is an AI website builder that turns your idea into a planned, working app—with the interface, backend, and database included.</p><div className="mx-auto mt-10 max-w-[1100px] px-2 py-8 sm:px-8"><CardStack items={CARD_ITEMS} initialIndex={1} autoAdvance intervalMs={3000} pauseOnHover showDots cardWidth={350} cardHeight={430} renderCard={(item) => <WebsiteBuilderCard item={item} />} /></div><div className="mt-16 flex justify-center"><button onClick={begin} className="group inline-flex items-center gap-3 rounded-full border border-[#b9c3c4] bg-white px-5 py-2.5 text-[14px] shadow-sm"><span>Start building</span><span className="grid h-7 w-7 place-items-center rounded-full bg-[#eef0ef] transition group-hover:translate-x-0.5"><ArrowUpRight size={15} /></span></button></div></section>

    <section className="relative min-h-[640px] overflow-hidden px-6 py-28 md:py-36"><div className="absolute inset-0 bg-cover bg-center opacity-90" style={{ backgroundImage: `url(${HERO})` }} /><div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,#fafbf8_0%,#fafbf8_28%,rgba(250,251,248,.95)_40%,rgba(250,251,248,.62)_56%,rgba(250,251,248,.16)_72%,transparent_86%)]" /><div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(250,251,248,.18),transparent_20%,transparent_80%,rgba(250,251,248,.18))]" /><div className="relative mx-auto max-w-[900px]"><div className="flex flex-col justify-between gap-12 pt-12 md:flex-row"><div><Brand /><p className="mt-5 max-w-[220px] text-[15px] leading-6 text-[#69747a]">Describe an app. Keep every line of code.</p><p className="mt-10 text-[13px] text-[#69747a]">© 2026 Sizzer. All rights reserved.</p></div><div className="grid grid-cols-2 gap-x-12 gap-y-10 text-[14px] md:grid-cols-4"><div><p className="mb-4 font-semibold">Product</p><a className="block py-1.5 text-[#69747a]" href="#how">How it works</a><a className="block py-1.5 text-[#69747a]" href="#questions">Questions</a></div><div><p className="mb-4 font-semibold">Build</p><Link className="block py-1.5 text-[#69747a]" href="/signup">Start a project</Link><Link className="block py-1.5 text-[#69747a]" href="/dashboard">Your projects</Link></div><div><p className="mb-4 font-semibold">Account</p><Link className="block py-1.5 text-[#69747a]" href="/login">Sign in</Link><Link className="block py-1.5 text-[#69747a]" href="/signup">Create account</Link></div><div><p className="mb-4 font-semibold">More</p><a className="block py-1.5 text-[#69747a]" href="https://github.com/Nitinref/seezer.ai" target="_blank" rel="noreferrer">GitHub</a></div></div></div><div className="pointer-events-none mt-10 select-none text-center text-[clamp(100px,20vw,270px)] font-semibold leading-none tracking-[0.08em] text-sky-900/30">sizzer</div></div></section>
  </main>;
}

