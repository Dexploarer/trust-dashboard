"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Leaderboard" },
  { href: "/agents", label: "Agents" },
  { href: "/ecosystem", label: "Ecosystem" },
  { href: "/scoring", label: "Scoring" },
  { href: "/simulator", label: "Simulator" },
];

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function SiteHeader() {
  const pathname = usePathname();
  const normalized = normalizePathname(pathname);
  const isHome = normalized === "/" || normalized === "/trust-dashboard";

  if (isHome) {
    return null;
  }

  return (
    <header className="border-b border-border/80 glass">
      <div className="mx-auto max-w-6xl px-4 py-4 flex flex-wrap items-center justify-between gap-2">
        <Link href="/" className="inline-flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-violet-100 text-violet-700 text-xs font-semibold">
            M
          </span>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            milaidy/dashboard
          </span>
        </Link>
        <nav className="flex items-center gap-1.5">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <a
            href="https://github.com/milady-ai/milaidy"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}
