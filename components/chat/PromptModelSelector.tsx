"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

type ModelChoice = {
  label: string;
  provider?: "gemini" | "openrouter";
  model?: string;
};

const CHOICES: ModelChoice[] = [
  { label: "Auto" },
  { label: "Gemini 3.8 Flash", provider: "gemini", model: "gemini-3.8-flash" },
  { label: "OpenRouter Free", provider: "openrouter", model: "openrouter/free" },
];

const PROVIDER_KEY = "forge_ai_provider";
const MODEL_KEY = "forge_ai_model";

export function PromptModelSelector() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("Auto");

  useEffect(() => {
    const provider = window.localStorage.getItem(PROVIDER_KEY);
    const model = window.localStorage.getItem(MODEL_KEY);
    const saved = CHOICES.find((choice) => choice.provider === provider && choice.model === model);
    setSelected(saved?.label ?? "Auto");
  }, []);

  function choose(choice: ModelChoice) {
    setSelected(choice.label);
    setOpen(false);
    if (!choice.provider || !choice.model) {
      window.localStorage.removeItem(PROVIDER_KEY);
      window.localStorage.removeItem(MODEL_KEY);
      return;
    }
    window.localStorage.setItem(PROVIDER_KEY, choice.provider);
    window.localStorage.setItem(MODEL_KEY, choice.model);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Choose AI model"
        className="inline-flex h-8 min-w-[142px] items-center justify-between gap-2 rounded-full border border-sky-400/80 bg-[#17191d] px-3 text-[13px] text-white/70 shadow-[0_0_0_1px_rgba(56,189,248,.12)] transition hover:border-sky-300 hover:text-white"
      >
        <span>Model: <strong className="font-semibold text-white">{selected}</strong></span>
        <ChevronDown size={14} className={`text-white/45 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute bottom-[calc(100%+8px)] left-0 z-50 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#151619]/95 p-1.5 shadow-2xl backdrop-blur-xl">
          {CHOICES.map((choice) => {
            const active = choice.label === selected;
            return (
              <button
                key={choice.label}
                type="button"
                onClick={() => choose(choice)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] transition ${active ? "bg-sky-400/10 text-white" : "text-white/60 hover:bg-white/[0.06] hover:text-white"}`}
              >
                {choice.label}
                {active && <Check size={14} className="text-sky-300" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
