"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Accessibility,
  Check,
  Code2,
  FileUp,
  LayoutTemplate,
  MessageSquareText,
  Palette,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import AceternitySidebar from "@/components/sidebar/AceternitySidebar";

type Skill = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  trigger: string;
  tags: string[];
  source: "built-in" | "yours";
  icon: "design" | "responsive" | "voice" | "accessibility" | "code" | "custom";
};

const STORAGE_KEY = "sizzer.skills";

const builtInSkills: Skill[] = [
  {
    id: "frontend-design",
    name: "Frontend design",
    description: "Create polished interfaces with clear visual hierarchy, intentional spacing, and thoughtful interaction states.",
    instructions: "Use a deliberate type scale, visual rhythm, responsive layout, accessible contrast, and useful loading or empty states. Avoid generic template layouts.",
    trigger: "website, landing page, dashboard, portfolio, UI",
    tags: ["ui", "visual design", "responsive"],
    source: "built-in",
    icon: "design",
  },
  {
    id: "responsive-layout",
    name: "Responsive layout",
    description: "Make layouts feel deliberate from compact phones through wide desktop screens.",
    instructions: "Use fluid grids, preserve comfortable touch targets, prevent horizontal overflow, and test the important actions at narrow widths.",
    trigger: "responsive, mobile, layout",
    tags: ["mobile", "css", "layout"],
    source: "built-in",
    icon: "responsive",
  },
  {
    id: "accessibility-check",
    name: "Accessibility check",
    description: "Review keyboard navigation, semantic structure, focus states, labels, and contrast before delivery.",
    instructions: "Use semantic HTML, visible focus indicators, labelled controls, sufficient contrast, and respect reduced motion preferences.",
    trigger: "accessibility, audit, a11y",
    tags: ["a11y", "quality"],
    source: "built-in",
    icon: "accessibility",
  },
  {
    id: "product-copy",
    name: "Product voice",
    description: "Write concise, confident product copy that helps users understand the next action.",
    instructions: "Prefer clear language over filler. Give actions descriptive labels and include helpful empty, error, and success messages.",
    trigger: "copy, content, marketing, tone",
    tags: ["copy", "ux writing"],
    source: "built-in",
    icon: "voice",
  },
  {
    id: "clean-react",
    name: "Clean React",
    description: "Build focused React components with maintainable state and no unnecessary dependencies.",
    instructions: "Keep components cohesive, reuse existing project conventions, and prioritise a buildable implementation over extra abstraction.",
    trigger: "react, component, refactor",
    tags: ["react", "code quality"],
    source: "built-in",
    icon: "code",
  },
];

const iconFor = (kind: Skill["icon"]) => {
  const className = "h-4 w-4";
  if (kind === "design") return <Palette className={className} />;
  if (kind === "responsive") return <LayoutTemplate className={className} />;
  if (kind === "accessibility") return <Accessibility className={className} />;
  if (kind === "voice") return <MessageSquareText className={className} />;
  if (kind === "code") return <Code2 className={className} />;
  return <Wand2 className={className} />;
};

function SkillsPageContent() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "yours" | "built-in">("all");
  const [skills, setSkills] = useState<Skill[]>(builtInSkills);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [trigger, setTrigger] = useState("");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const saved = JSON.parse(stored) as Skill[];
      if (Array.isArray(saved)) setSkills([...builtInSkills, ...saved]);
    } catch {
      // A malformed local draft should never block the workspace.
    }
  }, []);

  const yourSkills = skills.filter((skill) => skill.source === "yours");
  const visibleSkills = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return skills.filter((skill) => {
      const sourceMatches = tab === "all" || (tab === "yours" ? skill.source === "yours" : skill.source === "built-in");
      const textMatches = !needle || [skill.name, skill.description, skill.trigger, ...skill.tags].join(" ").toLowerCase().includes(needle);
      return sourceMatches && textMatches;
    });
  }, [query, skills, tab]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setInstructions("");
    setTrigger("");
    setShowAdd(false);
  };

  const addSkill = (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || !instructions.trim()) return;
    const newSkill: Skill = {
      id: `skill-${crypto.randomUUID()}`,
      name: trimmedName,
      description: description.trim() || "Reusable instructions for your future builds.",
      instructions: instructions.trim(),
      trigger: trigger.trim() || trimmedName.toLowerCase(),
      tags: trigger.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 3),
      source: "yours",
      icon: "custom",
    };
    const next = [...skills, newSkill];
    setSkills(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next.filter((skill) => skill.source === "yours")));
    resetForm();
    setTab("yours");
  };

  const removeSkill = (id: string) => {
    const next = skills.filter((skill) => skill.id !== id);
    setSkills(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next.filter((skill) => skill.source === "yours")));
  };

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-[#0d0e11] text-white md:flex-row">
      <AceternitySidebar onNewProject={() => { window.location.href = "/dashboard"; }} />
      <main className="relative m-2 min-h-0 min-w-0 flex-1 overflow-y-auto rounded-[26px] border border-white/10 bg-[#06070a]">
        <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(circle_at_55%_-15%,rgba(38,153,255,.16),transparent_32%),radial-gradient(circle_at_93%_0%,rgba(124,58,237,.12),transparent_24%)]" />
        <section className="relative mx-auto max-w-[1040px] px-6 pb-20 pt-16 sm:px-10 lg:pt-24">
          <div className="flex flex-col gap-8 border-b border-white/10 pb-10 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-sky-300/80">Settings / Skills</p>
              <h1 className="mt-4 font-sans text-4xl font-semibold tracking-[-0.055em] text-white sm:text-5xl">Skills library</h1>
              <p className="mt-4 max-w-xl text-[15px] leading-6 text-white/50">Reusable instructions Sizzer applies when they match a build. Your skills are available in every project.</p>
            </div>
            <button onClick={() => setShowAdd(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_28px_rgba(14,165,233,.22)] transition hover:bg-sky-400">
              <Plus size={17} /> Add skill
            </button>
          </div>

          <div className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-[#101115] shadow-2xl shadow-black/20">
            <div className="grid lg:grid-cols-[1.15fr_.85fr]">
              <div className="p-6 sm:p-8">
                <h2 className="font-sans text-2xl font-semibold tracking-[-0.04em]">Teach Sizzer how you work.</h2>
                <div className="mt-7 divide-y divide-white/10 border-y border-white/10">
                  {[
                    [<Wand2 key="a" size={18} />, "Add a skill", "Write one yourself, import a Markdown file, or start from a built-in skill."],
                    [<Sparkles key="b" size={18} />, "Build like usual", "When a request matches a skill, Sizzer applies its instructions automatically."],
                    [<MessageSquareText key="c" size={18} />, "Call one by name", "Type / followed by its name in chat when you want to apply a skill deliberately."],
                  ].map(([icon, title, text]) => <div key={String(title)} className="flex gap-4 py-5"><span className="mt-0.5 text-sky-300">{icon}</span><div><h3 className="text-sm font-medium text-white/90">{title}</h3><p className="mt-1 text-sm leading-5 text-white/45">{text}</p></div></div>)}
                </div>
              </div>
              <div className="relative hidden min-h-[320px] overflow-hidden border-l border-white/10 bg-[radial-gradient(circle_at_center,rgba(14,165,233,.16),transparent_48%)] lg:block">
                <div className="absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.055)_1px,transparent_1px)] [background-size:28px_28px] opacity-40" />
                <div className="absolute left-1/2 top-1/2 grid h-28 w-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-sky-300/40 bg-sky-400/10 text-sky-200 shadow-[0_0_70px_rgba(14,165,233,.35)]"><Sparkles size={42} /></div>
                <span className="absolute left-5 top-16 rounded border border-sky-400/30 bg-[#07131c] px-2 py-1 font-mono text-[10px] text-sky-300">/frontend-design</span>
                <span className="absolute right-5 top-24 rounded border border-violet-400/30 bg-[#110c1d] px-2 py-1 font-mono text-[10px] text-violet-300">/product-voice</span>
                <span className="absolute bottom-16 left-8 rounded border border-cyan-400/30 bg-[#07131c] px-2 py-1 font-mono text-[10px] text-cyan-200">/responsive-layout</span>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-[430px]"><Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search skills" className="h-11 w-full rounded-xl border border-white/10 bg-white/[.035] pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-sky-400/50 focus:bg-white/[.055]" /></div>
            <div className="flex rounded-xl border border-white/10 bg-white/[.025] p-1 text-sm">
              {(["all", "yours", "built-in"] as const).map((value) => <button key={value} onClick={() => setTab(value)} className={`rounded-lg px-3 py-2 capitalize transition ${tab === value ? "bg-white/10 text-white" : "text-white/45 hover:text-white/80"}`}>{value === "built-in" ? "Built in" : value}{value === "all" ? ` ${skills.length}` : value === "yours" ? ` ${yourSkills.length}` : ` ${builtInSkills.length}`}</button>)}
            </div>
          </div>

          <div className="mt-10 flex items-end justify-between"><div><h2 className="font-sans text-2xl font-semibold tracking-[-0.04em]">{tab === "yours" ? "Your skills" : "Skills"}</h2><p className="mt-2 text-sm text-white/45">{visibleSkills.length} reusable {visibleSkills.length === 1 ? "instruction" : "instructions"}</p></div></div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {visibleSkills.map((skill) => <article key={skill.id} className="group rounded-2xl border border-white/10 bg-[#111217] p-5 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-[#15171d]"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-sky-300/15 bg-sky-400/10 text-sky-200">{iconFor(skill.icon)}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="truncate text-base font-semibold text-white/90">{skill.name}</h3>{skill.source === "built-in" && <span className="rounded-full bg-white/7 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/45">Built in</span>}</div><p className="mt-2 line-clamp-2 text-sm leading-5 text-white/48">{skill.description}</p></div>{skill.source === "yours" && <button onClick={() => removeSkill(skill.id)} title="Delete skill" className="grid h-8 w-8 place-items-center rounded-lg text-white/30 opacity-0 transition hover:bg-rose-400/10 hover:text-rose-300 group-hover:opacity-100"><Trash2 size={15} /></button>}</div><div className="mt-5 flex flex-wrap gap-1.5">{skill.tags.map((tag) => <span key={tag} className="rounded-md border border-white/8 bg-white/[.035] px-2 py-1 font-mono text-[10px] text-white/45">{tag}</span>)}</div><div className="mt-5 flex items-center gap-2 border-t border-white/8 pt-4 text-xs text-white/40"><Check size={14} className="text-emerald-300" /> Applies automatically when relevant</div></article>)}
          </div>
          {visibleSkills.length === 0 && <div className="mt-6 rounded-2xl border border-dashed border-white/15 py-14 text-center text-sm text-white/45">No skills match this search.</div>}
        </section>
      </main>

      {showAdd && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"><form onSubmit={addSkill} className="w-full max-w-xl rounded-2xl border border-white/15 bg-[#14151a] p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[11px] uppercase tracking-[.18em] text-sky-300">New reusable skill</p><h2 className="mt-2 font-sans text-2xl font-semibold">Add a skill</h2></div><button type="button" onClick={resetForm} className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white"><X size={18} /></button></div><div className="mt-6 space-y-4"><label className="block text-sm text-white/65">Name<input value={name} onChange={(event) => setName(event.target.value)} required placeholder="e.g. Brand voice" className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-white outline-none focus:border-sky-400/50" /></label><label className="block text-sm text-white/65">Short description<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What does this skill help with?" className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-white outline-none focus:border-sky-400/50" /></label><label className="block text-sm text-white/65">Instructions<textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} required rows={5} placeholder="Tell the builder how to work..." className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-white outline-none focus:border-sky-400/50" /></label><label className="block text-sm text-white/65">Trigger words <span className="text-white/35">(comma separated)</span><input value={trigger} onChange={(event) => setTrigger(event.target.value)} placeholder="brand, marketing, landing page" className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-white outline-none focus:border-sky-400/50" /></label></div><div className="mt-6 flex items-center justify-between"><button type="button" className="inline-flex items-center gap-2 text-sm text-white/45 hover:text-white"><FileUp size={16} /> Import later</button><button type="submit" className="rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-400">Save skill</button></div></form></div>}
    </div>
  );
}

export default function SkillsPage() {
  return <AuthGuard><SkillsPageContent /></AuthGuard>;
}
