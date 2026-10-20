"use client";
import React, { useState, useEffect } from "react";
import { Zap, ChevronDown } from "lucide-react";

const PROVIDERS = [
  {
    id: "openai",
    label: "OpenAI",
    models: [
      { id: "gpt-4o",       label: "GPT-4o"        },
      { id: "gpt-4o-mini",  label: "GPT-4o Mini"   },
      { id: "gpt-4-turbo",  label: "GPT-4 Turbo"   },
    ],
  },
  {
    id: "gemini",
    label: "Google Gemini",
    models: [
      { id: "gemini-2.0-flash",         label: "Gemini 2.0 Flash"    },
      { id: "gemini-2.0-flash-lite",    label: "Gemini 2.0 Flash Lite" },
      { id: "gemini-1.5-pro",           label: "Gemini 1.5 Pro"      },
      { id: "gemini-1.5-flash",         label: "Gemini 1.5 Flash"    },
    ],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    models: [
      { id: "openrouter/free", label: "OpenRouter Free Router" },
    ],
  },
];

const STORAGE_KEY = "forge_ai_provider";
const STORAGE_MODEL_KEY = "forge_ai_model";
const DEFAULT_PROVIDER = "openrouter";
const DEFAULT_MODEL = "openrouter/free";

export function ModelSelector() {
  const [open, setOpen]         = useState(false);
  const [provider, setProvider] = useState(DEFAULT_PROVIDER);
  const [model, setModel]       = useState(DEFAULT_MODEL);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    const savedProvider = localStorage.getItem(STORAGE_KEY) || DEFAULT_PROVIDER;
    const savedModel = localStorage.getItem(STORAGE_MODEL_KEY) || DEFAULT_MODEL;
    const oldModel = savedModel === "qwen/qwen-2.5-coder:free" || savedModel === "deepseek/deepseek-chat-v3-0324:free";
    setProvider(savedProvider);
    setModel(oldModel ? DEFAULT_MODEL : savedModel);
    if (oldModel) localStorage.setItem(STORAGE_MODEL_KEY, DEFAULT_MODEL);
  }, []);

  const currentProvider = PROVIDERS.find(p => p.id === provider) ?? PROVIDERS[0];
  const currentModel    = currentProvider.models.find(m => m.id === model) ?? currentProvider.models[0];

  async function handleSelect(providerId: string, modelId: string) {
    setProvider(providerId);
    setModel(modelId);
    localStorage.setItem(STORAGE_KEY, providerId);
    localStorage.setItem(STORAGE_MODEL_KEY, modelId);
    setOpen(false);
    setSaving(true);

    // Tell backend to switch provider
    try {
      const token = localStorage.getItem("forge-auth") 
        ? JSON.parse(localStorage.getItem("forge-auth") || "{}").state?.token 
        : null;
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/settings/model`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider: providerId, model: modelId }),
      });
    } catch {}
    setSaving(false);
  }

  const providerColor = provider === "gemini" ? "#00d2ff" : provider === "openrouter" ? "#ff7a45" : "#7c5cfc";
  const providerIcon  = provider === "gemini" ? "✦" : provider === "openrouter" ? "◈" : "⬡";

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8,
          padding: "7px 10px", borderRadius: 8, border: "none",
          background: "var(--bg-3, #16161c)",
        //   @ts-ignore
          border: `1px solid ${open ? providerColor : "rgba(255,255,255,0.08)"}`,
          cursor: "pointer", transition: "all 0.15s",
        }}>
        <span style={{ fontSize: 12, color: providerColor }}>{providerIcon}</span>
        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{ fontSize: 10, color: "#555568", lineHeight: 1 }}>AI Model</div>
          <div style={{ fontSize: 11, fontWeight: 500, color: "#f0f0f8", marginTop: 2 }}>
            {saving ? "Saving…" : currentModel.label}
          </div>
        </div>
        <ChevronDown size={12} color="#555568"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: 0, right: 0,
          background: "#16161c", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 10, overflow: "hidden", zIndex: 100,
          boxShadow: "0 -8px 32px rgba(0,0,0,0.5)",
        }}>
          {PROVIDERS.map(prov => (
            <div key={prov.id}>
              <div style={{
                padding: "8px 12px 4px",
                fontSize: 10, fontWeight: 700, letterSpacing: "1px",
                textTransform: "uppercase",
                color: prov.id === "gemini" ? "#00d2ff" : prov.id === "openrouter" ? "#ff7a45" : "#7c5cfc",
                borderTop: prov.id !== PROVIDERS[0].id ? "1px solid rgba(255,255,255,0.06)" : "none",
              }}>
                {prov.label}
              </div>
              {prov.models.map(m => {
                const isActive = provider === prov.id && model === m.id;
                return (
                  <button key={m.id}
                    onClick={() => handleSelect(prov.id, m.id)}
                    style={{
                      width: "100%", textAlign: "left",
                      padding: "7px 12px", border: "none",
                      background: isActive ? "rgba(124,92,252,0.15)" : "transparent",
                      color: isActive ? "#f0f0f8" : "#8b8ba0",
                      fontSize: 12, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                    {m.label}
                    {isActive && <span style={{ fontSize: 10, color: prov.id === "gemini" ? "#00d2ff" : prov.id === "openrouter" ? "#ff7a45" : "#7c5cfc" }}>✓</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
