"use client";

import React from "react";
import {
  Activity,
  BookOpen,
  Clock3,
  ChevronDown,
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
  const [creditBalance, setCreditBalance] = React.useState<number>(() => asCreditBalance(user?.creditBalanceUsd));

  React.useEffect(() => {
    let active = true;
    const refreshBalance = async () => {
      try {
        const balance = await creditsApi.balance();
        if (active) setCreditBalance(asCreditBalance(balance));
      } catch {
        // The rest of the workspace remains usable if the balance request fails.
      }
    };
    void refreshBalance();
    const interval = window.setInterval(refreshBalance, 15_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

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
        <div className="flex flex-col gap-3">
          <SidebarLink
            link={{
              label: user?.name ?? user?.email ?? "User",
              href: "#",
              icon: (
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-500 text-xs font-semibold text-white">
                  {(user?.name ?? user?.email ?? "U").slice(0, 1).toUpperCase()}
                </div>
              ),
            }}
          />
          <SidebarLink
            link={{
                label: `$${creditBalance.toFixed(4)} credits`,
              href: "#",
              icon: <WalletCards className={`h-5 w-5 shrink-0 ${creditBalance <= 0 ? "text-rose-300" : "text-emerald-300"}`} />,
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
