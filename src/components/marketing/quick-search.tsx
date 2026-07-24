"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SearchEntry = { label: string; href: string; group: string };

const ENTRIES: SearchEntry[] = [
  { label: "How the reorder engine works", href: "/#how-it-works", group: "Page" },
  { label: "Pricing", href: "/#pricing", group: "Page" },
  { label: "About invii.ai", href: "/about", group: "Page" },
  { label: "9 location types", href: "/#locations", group: "Feature" },
  { label: "Lead-time-aware reorder points", href: "/#features", group: "Feature" },
  { label: "Case-pack rounding", href: "/#features", group: "Feature" },
  { label: "Approve or auto-charge", href: "/#features", group: "Feature" },
  { label: "Activity log", href: "/#features", group: "Feature" },
  { label: "Reports", href: "/#features", group: "Feature" },
  { label: "Log in", href: "/login", group: "Account" },
  { label: "Start free", href: "/signup", group: "Account" },
];

export function QuickSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return ENTRIES.filter((e) => e.label.toLowerCase().includes(q)).slice(0, 6);
  }, [query]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    if (href.startsWith("/#")) {
      if (window.location.pathname !== "/") {
        router.push(href);
        return;
      }
      document.getElementById(href.slice(2))?.scrollIntoView({ behavior: "smooth" });
    } else {
      router.push(href);
    }
  }

  return (
    <div className="relative hidden md:block">
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && matches[0]) go(matches[0].href);
          if (e.key === "Escape") inputRef.current?.blur();
        }}
        placeholder="Search features, pricing…"
        aria-label="Search invii.ai"
        className="h-9 w-56 rounded-full border border-border-hairline bg-surface-raised px-4 pr-12 text-sm text-foreground placeholder:text-foreground-muted/60 outline-none focus:border-brand-light"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border-hairline px-1.5 py-0.5 text-[10px] text-foreground-muted">
        /
      </kbd>
      {open && matches.length > 0 && (
        <ul className="absolute left-0 top-11 z-50 w-72 overflow-hidden rounded-xl border border-border-hairline bg-surface shadow-xl">
          {matches.map((m) => (
            <li key={m.label}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(m.href)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-surface-raised"
              >
                <span>{m.label}</span>
                <span className="text-xs text-foreground-muted">{m.group}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
