"use client";

import { Check, ChevronDown, Settings2, Sparkles } from "lucide-react";
import { SiAlibabadotcom, SiAnthropic, SiGooglegemini, SiMoonshotai, SiOpenrouter } from "react-icons/si";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Provider = "gemini" | "openrouter";
type Brand = "alibaba" | "claude" | "gemini" | "kimi" | "openrouter";
type ModelChoice = { label: string; provider?: Provider; model?: string; note: string; brand?: Brand };

const CHOICES: ModelChoice[] = [
  { label: "Auto", note: "Best available model" },
  { label: "Gemini 3.8 Flash", provider: "gemini", model: "gemini-3.8-flash", note: "Google · fast and capable", brand: "gemini" },
  { label: "OpenRouter Free", provider: "openrouter", model: "openrouter/free", note: "Free models · auto-routed", brand: "openrouter" },
  { label: "Kimi K2", provider: "openrouter", model: "moonshotai/kimi-k2", note: "Moonshot AI · reasoning and coding", brand: "kimi" },
  { label: "Qwen3 Coder", provider: "openrouter", model: "qwen/qwen3-coder", note: "Alibaba · agentic coding", brand: "alibaba" },
  { label: "Claude Haiku 4.5", provider: "openrouter", model: "anthropic/claude-haiku-4.5", note: "Anthropic · fast and capable", brand: "claude" },
];

const PROVIDER_KEY = "forge_ai_provider";
const MODEL_KEY = "forge_ai_model";

function ModelMark({ brand, size = "md" }: { brand?: Brand; size?: "sm" | "md" }) {
  const dimensions = size === "sm" ? "h-5 w-5" : "h-6 w-6";
  const iconSize = size === "sm" ? 18 : 21;
  if (brand === "gemini") return <SiGooglegemini size={iconSize} className={`${dimensions} shrink-0 text-[#8ab4f8]`} />;
  if (brand === "openrouter") return <SiOpenrouter size={iconSize} className={`${dimensions} shrink-0 text-white/70`} />;
  if (brand === "kimi") return <SiMoonshotai size={iconSize} className={`${dimensions} shrink-0 text-[#4f9dff]`} />;
  if (brand === "alibaba") return <SiAlibabadotcom size={iconSize} className={`${dimensions} shrink-0 text-[#ff6a00]`} />;
  if (brand === "claude") return <SiAnthropic size={iconSize} className={`${dimensions} shrink-0 text-[#d97757]`} />;
  return <span className={`${dimensions} grid shrink-0 place-items-center text-white/45`}><Sparkles size={size === "sm" ? 14 : 16} strokeWidth={1.7} /></span>;
}

export function PromptModelSelector() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ModelChoice>(CHOICES[0]);
  const [menuPosition, setMenuPosition] = useState({ left: 0, bottom: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const provider = window.localStorage.getItem(PROVIDER_KEY) as Provider | null;
    const model = window.localStorage.getItem(MODEL_KEY);
    setSelected(CHOICES.find((choice) => choice.provider === provider && choice.model === model) ?? CHOICES[0]);
  }, []);

  function choose(choice: ModelChoice) {
    setSelected(choice);
    setOpen(false);
    if (!choice.provider || !choice.model) {
      window.localStorage.removeItem(PROVIDER_KEY);
      window.localStorage.removeItem(MODEL_KEY);
      return;
    }
    window.localStorage.setItem(PROVIDER_KEY, choice.provider);
    window.localStorage.setItem(MODEL_KEY, choice.model);
  }

  function toggleMenu() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuPosition({ left: rect.left, bottom: window.innerHeight - rect.top + 10 });
    }
    setOpen((value) => !value);
  }

  return (
    <div className="relative">
      <button ref={triggerRef} type="button" onClick={toggleMenu} aria-expanded={open} aria-label="Choose AI model"
        className={`group inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] shadow-sm transition-all ${open ? "border-white/20 bg-[#303030]" : "border-white/[.10] bg-[#292929] hover:bg-[#333333]"}`}>
        <ModelMark brand={selected.brand} size="sm" />
        <span className="max-w-28 truncate font-medium text-white/90">{selected.label === "Auto" ? "Model" : selected.label}</span>
        <ChevronDown size={14} className={`text-white/40 transition duration-200 ${open ? "rotate-180 text-white/65" : ""}`} />
      </button>

      {open && typeof document !== "undefined" && createPortal(<div style={{ left: menuPosition.left, bottom: menuPosition.bottom }} className="fixed z-[100] w-[210px] overflow-hidden rounded-xl border border-white/[.12] bg-[#2c2c2c] p-1 shadow-[0_14px_34px_rgba(0,0,0,.5)]">
        <div className="space-y-0.5">
          {CHOICES.map((choice) => {
            const active = choice.label === selected.label;
            return <button key={choice.label} type="button" onClick={() => choose(choice)}
              className={`group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${active ? "bg-white/[.07]" : "hover:bg-white/[.07]"}`}>
              <ModelMark brand={choice.brand} size="sm" />
              <span className={`min-w-0 flex-1 truncate text-[14px] ${active ? "text-white" : "text-white/85 group-hover:text-white"}`}>{choice.label}</span>
              {active && <Check size={17} strokeWidth={2} className="text-[#3184f6]" />}
            </button>;
          })}
        </div>
        <div className="mt-1 border-t border-white/[.1] px-1 pt-1">
          <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] font-medium text-white/80" title="Model management will be available here when configured">
            <Settings2 size={16} className="text-white/50" />
            Manage Models
          </div>
        </div>
      </div>, document.body)}
    </div>
  );
}
