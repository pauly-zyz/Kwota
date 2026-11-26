"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "./Logo";
import { ConnectButton } from "./ConnectButton";
import { cn } from "./ui";

const links = [
  { href: "/#how", label: "How it works" },
  { href: "/#agents", label: "Agents" },
  { href: "/transparency/", label: "Transparency" },
  { href: "/docs/", label: "Docs" },
];

export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const inApp = path?.startsWith("/app") || path?.startsWith("/admin");
  return (
    <header className="sticky top-0 z-40 px-3 pt-3">
      <div className="glass mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 !rounded-full px-4 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.8)] sm:px-5">
        <Link href="/" aria-label="KWOTA home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-fog md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={cn("hover:text-fog-100", path === l.href && "text-fog-100")}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {inApp ? (
            <ConnectButton compact />
          ) : (
            <Link href="/app/" className="rounded-full bg-volt px-4 py-2 text-sm font-medium text-ink shadow-[0_0_24px_-6px_rgba(200,242,58,0.8)] hover:bg-volt-600">
              Open app
            </Link>
          )}
          <button className="rounded-full border border-white/10 p-2 text-fog md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
        </div>
      </div>
      {open && (
        <nav className="glass mx-auto mt-2 max-w-6xl px-5 py-3 md:hidden">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block py-2 text-sm text-fog-100">
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

export function AppTabs() {
  const path = usePathname();
  const tabs = [
    { href: "/app/", label: "Overview" },
    { href: "/app/keys/", label: "API keys" },
    { href: "/app/agents/", label: "Agents" },
    { href: "/app/playground/", label: "Playground" },
  ];
  return (
    <div className="glass mb-6 flex gap-1 overflow-x-auto !rounded-full p-1 text-sm">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn("whitespace-nowrap rounded-full px-4 py-1.5", path === t.href ? "bg-volt text-ink" : "text-fog hover:text-fog-100")}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
