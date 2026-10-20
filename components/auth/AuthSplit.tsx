"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";

const HERO = "/hero-balloon-meadow.png";

export function AuthSplit({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const pathname = usePathname();
  const signup = pathname === "/signup";
  return <main className="grid min-h-screen bg-white lg:grid-cols-2">
    <aside className="relative hidden min-h-screen overflow-hidden bg-[#13577a] lg:block">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `linear-gradient(180deg, rgba(5,53,82,.56), rgba(3,43,62,.46)), url(${HERO})` }} />
      <div className="relative z-10 flex min-h-screen flex-col justify-between p-12 text-white">
        <Link href="/" className="flex w-fit items-center gap-3 text-[22px] font-semibold tracking-[-0.04em] text-white no-underline"><span className="grid h-7 w-7 place-items-center rounded-full border-2 border-sky-300 text-[15px]">c</span>sizzer</Link>
        <div className="max-w-[400px]"><p className="mb-7 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/75">{signup ? "Welcome aboard" : "Welcome back"}</p><h2 className="font-serif text-[clamp(48px,5vw,74px)] leading-[.9] tracking-[-0.06em]">{signup ? <>Make something<br /><em>worth keeping.</em></> : <>Pick up where<br /><em>you left off.</em></>}</h2><p className="mt-8 max-w-[330px] text-[16px] leading-7 text-white/80">{signup ? "Your next idea starts with a sentence. Build it, keep it, and make it yours." : "Your projects, their source, and the conversation that made them are all where you left them."}</p></div>
        <p className="text-[13px] text-white/70">© 2026 Sizzer</p>
      </div>
    </aside>
    <section className="relative flex min-h-screen flex-col px-6 py-8 sm:px-12 lg:px-20"><div className="flex justify-end"><Link href={signup ? "/login" : "/signup"} className="rounded-full border border-[#d4dadd] px-5 py-2.5 text-[14px] text-[#17202b] no-underline transition hover:bg-[#f5f7f7]">{signup ? "Sign in" : "Create account"}</Link></div><div className="mx-auto flex w-full max-w-[500px] flex-1 flex-col justify-center py-12"><div className="mb-9"><p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7a858a]">Sizzer account</p><h1 className="text-[40px] font-medium tracking-[-0.055em] text-[#17202b]">{title}</h1><p className="mt-3 text-[16px] text-[#69747a]">{subtitle}</p></div>{children}</div><div className="text-center text-[12px] text-[#9aa2a5]">Your workspace, your code, your data.</div></section>
  </main>;
}

export function AuthInput({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <label className="block"><span className="mb-2 block text-[13px] font-medium text-[#17202b]">{label}</span><input {...props} className="h-12 w-full rounded-xl border border-[#d9e0e3] bg-[#f8faf9] px-4 text-[15px] text-[#17202b] outline-none transition placeholder:text-[#9aa2a5] focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100" /></label>; }

export function AuthSubmit({ children, loading }: { children: ReactNode; loading: boolean }) { return <button type="submit" disabled={loading} className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-[#239be7] text-[15px] font-semibold text-white transition hover:bg-[#148bd5] disabled:cursor-not-allowed disabled:opacity-60">{loading ? "Please wait…" : children}<ArrowUpRight size={16} className="ml-2" /></button>; }
