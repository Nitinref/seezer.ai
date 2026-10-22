import type { ComponentProps } from "react";

type SizzerLogoProps = {
  compact?: boolean;
  className?: string;
  iconClassName?: string;
  wordmarkClassName?: string;
} & Omit<ComponentProps<"span">, "className">;

/** A compact, original scissor mark designed to stay clear at sidebar size. */
export function SizzerMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className} fill="none">
      <defs>
        <linearGradient id="sizzer-coral" x1="7" y1="6" x2="31" y2="35" gradientUnits="userSpaceOnUse"><stop stopColor="#FF9474" /><stop offset=".48" stopColor="#FF4F79" /><stop offset="1" stopColor="#EF2675" /></linearGradient>
        <linearGradient id="sizzer-violet" x1="18" y1="42" x2="42" y2="11" gradientUnits="userSpaceOnUse"><stop stopColor="#FFFFFF" /><stop offset="1" stopColor="#EEF7FF" /></linearGradient>
        <linearGradient id="sizzer-steel" x1="14" y1="16" x2="33" y2="31" gradientUnits="userSpaceOnUse"><stop stopColor="#FF6E89" /><stop offset="1" stopColor="#E92768" /></linearGradient>
      </defs>
      <path d="M22.9 22.8C17.7 18.1 12.6 11.7 10.3 5.8c-.5-1.4 1.1-2.5 2.3-1.6 7.1 5.1 12.1 10.6 15.7 15.5l-5.4 3.1Z" fill="url(#sizzer-coral)" />
      <path d="M25.1 22.8c4.9-5.1 11.2-9.9 17.3-12.1 1.4-.5 2.5 1.1 1.6 2.3-5.1 7.1-10.6 12.1-15.5 15.7l-3.4-5.9Z" fill="url(#sizzer-violet)" />
      <path d="M22.6 25.4 9.1 37.6" stroke="url(#sizzer-coral)" strokeWidth="5.8" strokeLinecap="round" />
      <path d="m25.3 25.4 12.2 12.2" stroke="url(#sizzer-violet)" strokeWidth="5.8" strokeLinecap="round" />
      <circle cx="10.1" cy="38" r="6.7" stroke="url(#sizzer-coral)" strokeWidth="4.2" />
      <circle cx="37.9" cy="38" r="6.7" stroke="url(#sizzer-violet)" strokeWidth="4.2" />
      <circle cx="24" cy="24" r="5.6" fill="url(#sizzer-steel)" />
      <circle cx="22.3" cy="22.1" r="1.6" fill="white" fillOpacity=".88" />
    </svg>
  );
}

export function SizzerLogo({ compact = false, className = "", iconClassName = "", wordmarkClassName = "", ...props }: SizzerLogoProps) {
  return (
    <span className={`inline-flex items-center ${compact ? "" : "gap-3.5"} ${className}`} {...props}>
      <SizzerMark className={`shrink-0 ${compact ? "h-8 w-8" : "h-11 w-11"} ${iconClassName}`} />
      {!compact && <span className={`font-[family-name:var(--font-brand)] text-[21px] font-bold leading-none tracking-[-0.095em] ${wordmarkClassName}`}>sizzer</span>}
    </span>
  );
}
