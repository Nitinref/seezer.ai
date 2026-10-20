import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";

export const metadata: Metadata = {
  title: "Sizzer — AI App Builder",
  description: "Build production React apps with AI in seconds",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body className="font-mono bg-background text-foreground antialiased"><Providers>{children}</Providers></body></html>;
}
