"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type LiquidGlassButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

/** A compact glass button intended for controls placed over an image or gradient. */
export const LiquidGlassButton = React.forwardRef<HTMLButtonElement, LiquidGlassButtonProps>(
  ({ className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden rounded-full border border-white/75 border-b-[#082d50]/70 border-r-[#082d50]/70 bg-[linear-gradient(135deg,rgb(255_255_255_/_25%),rgb(255_255_255_/_07%))] text-[#14283d] shadow-[inset_1px_1px_0_rgb(255_255_255_/_58%),inset_-1px_-1px_0_rgb(2_34_62_/_32%),0_5px_12px_rgb(1_35_65_/_30%)] backdrop-blur-xl backdrop-saturate-150 transition duration-200 hover:-translate-y-px hover:bg-white/[0.18] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:pointer-events-none disabled:opacity-50 dark:border-white/35 dark:border-b-black/75 dark:border-r-black/75 dark:bg-[linear-gradient(135deg,rgb(255_255_255_/_14%),rgb(0_0_0_/_18%))] dark:text-white dark:shadow-[inset_1px_1px_0_rgb(255_255_255_/_18%),inset_-1px_-1px_0_rgb(0_0_0_/_72%),0_5px_12px_rgb(0_0_0_/_45%)]",
        className,
      )}
      {...props}
    >
      <span className="pointer-events-none absolute inset-x-4 top-px h-px rounded-full bg-white/85 dark:bg-white/30" />
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </button>
  ),
);

LiquidGlassButton.displayName = "LiquidGlassButton";
