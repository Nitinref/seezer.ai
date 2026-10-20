"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AuthInput, AuthSplit, AuthSubmit } from "@/components/auth/AuthSplit";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { loginMutation } = useAuth();

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); loginMutation.mutate({ email, password }); }

  return <AuthSplit title="Welcome back" subtitle="Sign in to continue making.">
    <div className="grid grid-cols-2 gap-3"><button type="button" className="h-12 rounded-xl border border-[#d9e0e3] bg-[#f8faf9] text-[14px] font-medium text-[#17202b] hover:bg-white">🌈 &nbsp;Google</button><button type="button" className="h-12 rounded-xl border border-[#d9e0e3] bg-[#f8faf9] text-[14px] font-medium text-[#17202b] hover:bg-white">◉ &nbsp;GitHub</button></div>
    <div className="my-6 flex items-center gap-3 text-[13px] text-[#899398]"><span className="h-px flex-1 bg-[#e3e7e8]" />Or continue with your email<span className="h-px flex-1 bg-[#e3e7e8]" /></div>
    <form onSubmit={submit} className="space-y-5"><AuthInput label="Email address" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required /><AuthInput label="Password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required /><p className="-mt-1 text-[13px] text-[#7c878b]">Use the password for your Sizzer account.</p><AuthSubmit loading={loginMutation.isPending}>Sign in</AuthSubmit></form>
    <div className="mt-7 text-center text-[14px] text-[#69747a]"><Link href="#" className="text-[#168fdb] underline">Verify your email</Link><p className="mt-8">New to Sizzer? <Link href="/signup" className="text-[#168fdb] underline">Create a workspace</Link></p></div>
  </AuthSplit>;
}
