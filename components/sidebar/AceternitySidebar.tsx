"use client";

import React from "react";
import {
  Activity,
  BookOpen,
  Clock3,
  ChevronDown,
  ChevronRight,
  Laptop,
  LogOut,
  MessageCirclePlus,
  Moon,
  Settings,
  Sun,
  Folder,
  Home,
  LayoutGrid,
  LibraryBig,
  Newspaper,
  Plus,
  Star,
  WalletCards,
} from "lucide-react";
import {
  IconArrowLeft,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { creditsApi } from "@/lib/api";

function asCreditBalance(value: unknown, fallback = 2) {
  const balance = Number(value);
  return Number.isFinite(balance) ? balance : fallback;
}

export default function AceternitySidebar({ onNewProject }: { onNewProject?: () => void }) {
  const [open, setOpen] = React.useState(true);
  const { logout, user } = useAuth();
  const [accountMenuOpen, setAccountMenuOpen] = React.useState(false);
  const [theme, setTheme] = React.useState<"system" | "light" | "dark">(() => {
    const saved = typeof window === "undefined" ? null : window.localStorage.getItem("sizzer.theme");
    return saved === "system" || saved === "light" || saved === "dark" ? saved : "dark";
  });
  const accountMenuRef = React.useRef<HTMLDivElement>(null);
  const [creditBalance, setCreditBalance] = React.useState<number>(() => asCreditBalance(user?.creditBalanceUsd));
  const [unlimitedCredits, setUnlimitedCredits] = React.useState(Boolean(user?.unlimitedCredits));

  React.useEffect(() => {
    let active = true;
    const refreshBalance = async () => {
      try {
        const credits = await creditsApi.balance();
        if (active) {
          setUnlimitedCredits(credits.unlimited);
          if (!credits.unlimited) setCreditBalance(asCreditBalance(credits.balanceUsd));
        }
      } catch {
        // The rest of the workspace remains usable if the balance request fails.
      }
    };
    void refreshBalance();
    const interval = window.setInterval(refreshBalance, 15_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    root.classList.toggle("workspace-light", theme === "light");
  }, [theme]);

  React.useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountMenuOpen(false);
    };
    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const selectTheme = (nextTheme: "system" | "light" | "dark") => {
    const root = document.documentElement;
    if (nextTheme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", nextTheme);
    root.classList.toggle("workspace-light", nextTheme === "light");
    setTheme(nextTheme);
    window.localStorage.setItem("sizzer.theme", nextTheme);
  };

  const links = [
    {
      label: "Home",
      href: "#",
      icon: <Home className="h-5 w-5 shrink-0 text-white/75" />,
    },
    {
      label: "Projects",
      href: "#",
      icon: <LayoutGrid className="h-5 w-5 shrink-0 text-white/75" />,
    },
    {
      label: "Skills",
      href: "/skills",
      icon: <LibraryBig className="h-5 w-5 shrink-0 text-white/75" />,
    },
    {
      label: "Starred",
      href: "#",
      icon: <Star className="h-5 w-5 shrink-0 text-white/75" />,
    },
    {
      label: "Recently viewed",
      href: "#",
      icon: <Clock3 className="h-5 w-5 shrink-0 text-white/75" />,
    },
    {
      label: "Shared with you",
      href: "#",
      icon: <Folder className="h-5 w-5 shrink-0 text-white/75" />,
    },
  ];

  const resourceLinks = [
    { label: "Help Center", icon: <BookOpen className="h-5 w-5 shrink-0 text-white/75" /> },
    { label: "Release notes", icon: <Newspaper className="h-5 w-5 shrink-0 text-white/75" /> },
    { label: "Status", icon: <Activity className="h-5 w-5 shrink-0 text-white/75" /> },
  ];

  return (
    <Sidebar open={open} setOpen={setOpen} hoverExpand={false}>
      <SidebarBody className="m-2 !h-[calc(100%-1rem)] justify-between gap-10 rounded-2xl border border-white/10 bg-[#181818] !px-2 py-6 shadow-2xl">
        <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
          <div
            className={`flex items-center gap-2 ${
              open ? "justify-end" : "flex-col justify-center"
            }`}
          >
            {open ? (
              <>
                <button
                  type="button"
                  aria-label="Create new project"
                  onClick={onNewProject}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white/55 transition hover:bg-white/10 hover:text-white"
                >
                  <Plus size={18} />
                </button>
                <button
                  type="button"
                  aria-label="Collapse sidebar"
                  onClick={() => setOpen(false)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white/55 transition hover:bg-white/10 hover:text-white"
                >
                  <IconChevronLeft size={18} />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  aria-label="Expand sidebar"
                  onClick={() => setOpen(true)}
                  className="mx-auto grid h-8 w-8 shrink-0 place-items-center rounded-md text-white/65 transition hover:bg-white/10 hover:text-white"
                >
                  <IconChevronRight size={20} />
                </button>
                <button
                  type="button"
                  aria-label="Create new project"
                  onClick={onNewProject}
                  className="mx-auto mt-3 grid h-8 w-8 shrink-0 place-items-center rounded-md text-white/65 transition hover:bg-white/10 hover:text-white"
                >
                  <Plus size={20} />
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            className={`mt-6 flex min-h-[54px] items-center gap-3 rounded-xl text-left transition ${
              open
                ? "border border-white/10 bg-[#1d1d20] px-3 hover:border-white/20 hover:bg-[#242428]"
                : "justify-center border-transparent bg-transparent px-0 hover:bg-white/[0.06]"
            }`}
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/15 bg-gradient-to-br from-cyan-300 via-sky-500 to-blue-700 text-sm font-bold text-white">
              {(user?.name ?? user?.email ?? "U").slice(0, 1).toUpperCase()}
            </div>
            {open && (
              <>
                <span className="min-w-0 flex-1 truncate text-[17px] font-medium text-white/90">
                  {user?.name ?? "sizzer user"}
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-white/85">
                  Free
                </span>
                <ChevronDown size={17} className="text-white/60" />
              </>
            )}
          </button>
          <div className="mt-5 flex flex-col gap-1">
            {links.map((link) => (
              <SidebarLink
                key={link.label}
                link={link}
                className="rounded-xl px-3 text-[17px] text-white/75 transition hover:bg-white/[0.07] hover:text-white"
              />
            ))}
            <div className="my-3 border-t border-white/15" />
            <div className="flex flex-col gap-1">
              {resourceLinks.map((link) => (
                <SidebarLink
                  key={link.label}
                  link={{ ...link, href: "#" }}
                  className="rounded-xl px-3 text-[17px] text-white/75 transition hover:bg-white/[0.07] hover:text-white"
                />
              ))}
            </div>
          </div>
        </div>
        <div ref={accountMenuRef} className="relative flex flex-col gap-3">
          {accountMenuOpen && (
            <div
              role="dialog"
              aria-label="Account menu"
              className={`absolute bottom-[calc(100%+12px)] z-50 w-80 overflow-hidden rounded-2xl border border-white/15 bg-[#0b0b0d] py-2 text-[16px] shadow-[0_18px_55px_rgba(0,0,0,0.6)] ${
                open ? "left-0" : "left-0"
              }`}
            >
              <div className="flex items-center gap-3 px-4 pb-4 pt-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">{user?.name ?? "sizzer user"}</p>
                  <p className="truncate text-sm text-white/55">{user?.email ?? "Signed in account"}</p>
                </div>
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 bg-gradient-to-br from-rose-300 via-orange-300 to-violet-600 text-xs font-bold text-white">
                  {(user?.name ?? user?.email ?? "U").slice(0, 1).toUpperCase()}
                </div>
              </div>
              <div className="border-t border-white/10" />
              <div className="px-2 py-2">
                <button type="button" className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-white/90 transition hover:bg-white/10">
                  <span>Settings</span><Settings size={20} className="text-white/60" />
                </button>
                <button type="button" className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-white/90 transition hover:bg-white/10">
                  <span>Credit</span><span className="text-white/55">{unlimitedCredits ? "Unlimited" : creditBalance.toFixed(2)}</span>
                </button>
              </div>
              <div className="border-t border-white/10" />
              <div className="px-2 py-2">
                <button type="button" className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-white/90 transition hover:bg-white/10">
                  <span>Feedback</span><MessageCirclePlus size={20} className="text-white/60" />
                </button>
                <div className="flex items-center justify-between px-3 py-2.5 text-white/90">
                  <span>Theme</span>
                  <div className="flex rounded-xl border border-white/15 bg-black p-1">
                    {([
                      ["system", Laptop, "System"],
                      ["light", Sun, "Light"],
                      ["dark", Moon, "Dark"],
                    ] as const).map(([value, Icon, label]) => (
                      <button key={value} type="button" aria-label={label} title={label} onClick={() => selectTheme(value)} className={`grid h-7 w-7 place-items-center rounded-lg transition ${theme === value ? "bg-white/15 text-white" : "text-white/55 hover:text-white"}`}>
                        <Icon size={16} />
                      </button>
                    ))}
                  </div>
                </div>
                <button type="button" className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-white/90 transition hover:bg-white/10">
                  <span>More</span><ChevronRight size={20} className="text-white/60" />
                </button>
              </div>
              <div className="border-t border-white/10" />
              <div className="px-2 py-2">
                <button type="button" onClick={logout} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-white/90 transition hover:bg-white/10">
                  <span>Sign Out</span><LogOut size={20} className="text-white/60" />
                </button>
              </div>
            </div>
          )}
          <button
            type="button"
            aria-expanded={accountMenuOpen}
            aria-label="Open account menu"
            onClick={() => setAccountMenuOpen((current) => !current)}
            className={`flex w-full items-center gap-3 rounded-xl text-left transition hover:bg-white/[0.07] ${open ? "px-3 py-2" : "justify-center p-1"}`}
          >
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-500 text-xs font-semibold text-white">
              {(user?.name ?? user?.email ?? "U").slice(0, 1).toUpperCase()}
            </div>
            {open && <span className="min-w-0 flex-1 truncate text-[15px] text-white/90">{user?.name ?? user?.email ?? "User"}</span>}
            {open && <ChevronDown size={16} className={`shrink-0 text-white/50 transition ${accountMenuOpen ? "rotate-180" : ""}`} />}
          </button>
          <SidebarLink
            link={{
                label: unlimitedCredits ? "Unlimited credits" : `$${creditBalance.toFixed(4)} credits`,
              href: "#",
              icon: <WalletCards className={`h-5 w-5 shrink-0 ${unlimitedCredits || creditBalance > 0 ? "text-emerald-300" : "text-rose-300"}`} />,
            }}
            onClick={(event: React.MouseEvent<HTMLAnchorElement>) => event.preventDefault()}
          />
          <SidebarLink
            link={{
              label: "Logout",
              href: "#",
              icon: <IconArrowLeft className="h-5 w-5 shrink-0 text-white/75" />,
            }}
            onClick={(event: React.MouseEvent<HTMLAnchorElement>) => {
              event.preventDefault();
              logout();
            }}
          />
        </div>
      </SidebarBody>
    </Sidebar>
  );
}
