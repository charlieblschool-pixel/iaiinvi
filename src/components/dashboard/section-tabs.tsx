"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/** Underlined tab bar for sub-pages (e.g. Reports → Overview / Reorder list). */
export function SectionTabs({ tabs, label }: { tabs: { href: string; label: string }[]; label: string }) {
  const pathname = usePathname();
  // Longest matching href wins, so /reports doesn't also light up on /reports/reorder.
  const active = [...tabs]
    .sort((a, b) => b.href.length - a.href.length)
    .find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))?.href;

  return (
    <nav aria-label={label} className="flex gap-1 border-b border-border-hairline">
      {tabs.map((tab) => {
        const isActive = tab.href === active;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative -mb-px rounded-t-md px-4 py-2.5 text-sm font-medium transition-colors duration-200",
              isActive
                ? "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand-light"
                : "text-foreground-muted hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
