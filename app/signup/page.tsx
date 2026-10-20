"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AuthInput, AuthSplit, AuthSubmit } from "@/components/auth/AuthSplit";
import { useAuth } from "@/hooks/useAuth";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const { signupMutation } = useAuth();

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (password !== confirm) { window.alert("Passwords do not match"); return; } signupMutation.mutate({ name, email, password }); }

  return <AuthSplit title="Create your workspace" subtitle="Start building with Sizzer today.">
    <div className="grid grid-cols-2 gap-3"><button type="button" className="h-12 rounded-xl border border-[#d9e0e3] bg-[#f8faf9] text-[14px] font-medium text-[#17202b] hover:bg-white">🌈 &nbsp;Google</button><button type="button" className="h-12 rounded-xl border border-[#d9e0e3] bg-[#f8faf9] text-[14px] font-medium text-[#17202b] hover:bg-white">◉ &nbsp;GitHub</button></div>
    <div className="my-6 flex items-center gap-3 text-[13px] text-[#899398]"><span className="h-px flex-1 bg-[#e3e7e8]" />Or continue with your email<span className="h-px flex-1 bg-[#e3e7e8]" /></div>
    <form onSubmit={submit} className="space-y-4"><AuthInput label="Full name" type="text" placeholder="Jane Smith" value={name} onChange={(e) => setName(e.target.value)} autoFocus required /><AuthInput label="Email address" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required /><AuthInput label="Password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required /><AuthInput label="Confirm password" type="password" placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /><p className="text-[12px] leading-5 text-[#899398]">By creating an account you agree to our <Link href="#" className="underline">Terms of Service</Link> and <Link href="#" className="underline">Privacy Policy</Link>.</p><AuthSubmit loading={signupMutation.isPending}>Create account</AuthSubmit></form>
    <p className="mt-7 text-center text-[14px] text-[#69747a]">Already have an account? <Link href="/login" className="text-[#168fdb] underline">Sign in</Link></p>
  </AuthSplit>;
}
