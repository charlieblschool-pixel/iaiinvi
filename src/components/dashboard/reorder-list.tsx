"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import {
  SAFETY_BUFFER_DAYS,
  buildReorderList,
  type ReorderInputProduct,
  type ReorderLine,
  type Urgency,
} from "@/lib/reorder-math";

type GroupBy = "vendor" | "category" | "none";
type UrgencyFilter = "all" | "now" | "soon";

const BUFFER_OPTIONS = [0, 3, 7, 14, 21];

const URGENCY: Record<Urgency, { label: string; tone: "bad" | "warn" | "neutral" }> = {
  now: { label: "Order now", tone: "bad" },
  soon: { label: "Order soon", tone: "warn" },
  check: { label: "Check stock", tone: "neutral" },
};

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function ReorderList({ products }: { products: ReorderInputProduct[] }) {
  const [buffer, setBuffer] = useState(SAFETY_BUFFER_DAYS);
  const [groupBy, setGroupBy] = useState<GroupBy>("vendor");
  const [category, setCategory] = useState<string | null>(null);
  const [urgency, setUrgency] = useState<UrgencyFilter>("all");
  const [query, setQuery] = useState("");
  const searchId = useId();

  const all = useMemo(() => buildReorderList(products, { safetyBufferDays: buffer }), [products, buffer]);

  const categories = useMemo(
    () => Array.from(new Set(all.map((l) => l.product.category ?? "No category"))).sort(),
    [all],
  );

  const q = query.trim().toLowerCase();
  const visible = all.filter((l) => {
    if (category && (l.product.category ?? "No category") !== category) return false;
    if (urgency !== "all" && l.urgency !== urgency) return false;
    if (q) {
      const hay = `${l.product.name} ${l.product.code} ${l.product.brand ?? ""} ${l.product.vendor?.name ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const actionable = visible.filter((l) => l.urgency !== "check");
  const needsCheck = visible.filter((l) => l.urgency === "check");

  const groups = (() => {
    const map = new Map<string, ReorderLine[]>();
    for (const line of actionable) {
      const key =
        groupBy === "vendor"
          ? line.product.vendor?.name ?? "No vendor set"
          : groupBy === "category"
            ? line.product.category ?? "No category"
            : "All products";
      map.set(key, [...(map.get(key) ?? []), line]);
    }
    return Array.from(map.entries()).sort(([a], [b]) =>
      a.startsWith("No ") ? 1 : b.startsWith("No ") ? -1 : a.localeCompare(b),
    );
  })();

  const totalCost = actionable.reduce((s, l) => s + l.cost, 0);
  const nowCount = actionable.filter((l) => l.urgency === "now").length;
  const vendorCount = new Set(actionable.map((l) => l.product.vendor?.name ?? "")).size;

  function downloadCsv() {
    const rows = actionable.map((l) => ({
      Vendor: l.product.vendor?.name ?? "",
      Code: l.product.code,
      Product: l.product.name,
      Brand: l.product.brand ?? "",
      Category: l.product.category ?? "",
      "Order qty": l.quantity,
      Unit: l.product.unitLabel,
      Cases: l.cases ?? "",
      "Unit cost": l.product.unitCost,
      "Est. cost": Number(l.cost.toFixed(2)),
      "On hand": l.onHand,
      Urgency: URGENCY[l.urgency].label,
      Why: l.why.join(" "),
    }));
    const blob = new Blob(["﻿" + Papa.unparse(rows)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reorder-list-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150 active:scale-95",
      active
        ? "border-brand bg-brand/10 text-brand-light"
        : "border-border-hairline text-foreground-muted hover:border-white/40 hover:text-foreground",
    );

  if (all.length === 0) {
    return (
      <Card className="px-6 py-16 text-center">
        <h2 className="text-lg font-semibold">Nothing to reorder right now</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-foreground-muted">
          Everything is above its reorder point with enough stock to cover delivery time. Set reorder
          points and weekly usage on your products to make this list smarter.
        </p>
        <div className="mt-6">
          <Link href="/dashboard/inventory" className="text-sm text-brand-light hover:underline">
            Go to inventory
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-foreground-muted">
        What to order and why, worked out from your counts, reorder points, weekly usage and vendor
        lead times. This list doesn&rsquo;t place orders — automatic ordering is coming soon.
      </p>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Summary label="Products to order" value={String(actionable.length)} />
        <Summary label="Order now" value={String(nowCount)} tone={nowCount > 0 ? "bad" : undefined} />
        <Summary label="Estimated cost" value={money(totalCost)} />
        <Summary label="Vendors" value={String(vendorCount)} />
      </div>

      {/* Controls */}
      <Card className="flex flex-col gap-4 p-4 print:hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1.5 sm:w-72">
            <label htmlFor={searchId} className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
              Search
            </label>
            <Input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Product, code, brand or vendor"
              className="h-9"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wider text-foreground-muted">Group by</span>
              <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} className="h-9 w-40">
                <option value="vendor">Vendor</option>
                <option value="category">Backbar / Retail</option>
                <option value="none">Don&rsquo;t group</option>
              </Select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
                Extra safety stock
              </span>
              <Select value={buffer} onChange={(e) => setBuffer(Number(e.target.value))} className="h-9 w-40">
                {BUFFER_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d === 0 ? "None" : `${plural(d, "day")}`}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter the list">
          <button type="button" aria-pressed={urgency === "all" && !category} onClick={() => { setUrgency("all"); setCategory(null); }} className={chip(urgency === "all" && !category)}>
            All
          </button>
          <button type="button" aria-pressed={urgency === "now"} onClick={() => setUrgency(urgency === "now" ? "all" : "now")} className={chip(urgency === "now")}>
            Order now
          </button>
          <button type="button" aria-pressed={urgency === "soon"} onClick={() => setUrgency(urgency === "soon" ? "all" : "soon")} className={chip(urgency === "soon")}>
            Order soon
          </button>
          <span className="mx-1 h-4 w-px bg-border-hairline" aria-hidden />
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(category === c ? null : c)}
              className={chip(category === c)}
            >
              {c}
            </button>
          ))}
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" size="sm" onClick={downloadCsv} disabled={actionable.length === 0}>
              Download CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              Print
            </Button>
          </div>
        </div>
      </Card>

      <p className="sr-only" aria-live="polite">
        {plural(actionable.length, "product")} to order, estimated {money(totalCost)}.
      </p>

      {actionable.length === 0 ? (
        <Card className="px-6 py-12 text-center text-sm text-foreground-muted">
          Nothing matches these filters.
        </Card>
      ) : (
        groups.map(([name, lines], groupIndex) => {
          const subtotal = lines.reduce((s, l) => s + l.cost, 0);
          const lead = lines[0].product.vendor?.leadTimeDays;
          return (
            <section
              key={name}
              aria-labelledby={groupBy !== "none" ? `reorder-group-${groupIndex}` : undefined}
              aria-label={groupBy === "none" ? "Products to order" : undefined}
              className="flex flex-col gap-3"
            >
              {groupBy !== "none" && (
                <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
                  <h2 id={`reorder-group-${groupIndex}`} className="font-semibold">
                    {name}
                    <span className="ml-2 text-sm font-normal text-foreground-muted">
                      {plural(lines.length, "product")}
                      {groupBy === "vendor" && lead ? ` · ${lead}-day delivery` : ""}
                    </span>
                  </h2>
                  <span className="text-sm tabular-nums text-foreground-muted">{money(subtotal)}</span>
                </div>
              )}
              <ul className="flex flex-col gap-3">
                {lines.map((line) => (
                  <ReorderItem key={line.product.id} line={line} />
                ))}
              </ul>
            </section>
          );
        })
      )}

      {needsCheck.length > 0 && (
        <details className="group rounded-2xl border border-border-hairline bg-surface print:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
            <div>
              <h2 className="font-semibold">{plural(needsCheck.length, "product")} at zero with nothing to go on</h2>
              <p className="mt-0.5 text-sm text-foreground-muted">
                Counted as 0 but no reorder point or usage yet — maybe you don&rsquo;t stock them anymore.
                Set a reorder point to move them into the list above.
              </p>
            </div>
            <span aria-hidden className="text-foreground-muted transition-transform duration-200 group-open:rotate-180">▾</span>
          </summary>
          <ul className="flex flex-col gap-3 border-t border-border-hairline p-4">
            {needsCheck.map((line) => (
              <ReorderItem key={line.product.id} line={line} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Summary({ label, value, tone }: { label: string; value: string; tone?: "bad" }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone === "bad" && "text-status-bad")}>{value}</p>
    </Card>
  );
}

function ReorderItem({ line }: { line: ReorderLine }) {
  const { product } = line;
  const u = URGENCY[line.urgency];
  const unit = product.unitLabel || "unit";
  const whyId = `why-${product.id}`;

  return (
    <li>
      <Card className="p-5 transition-colors duration-200 hover:border-white/20 print:break-inside-avoid">
        <article aria-describedby={whyId}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={u.tone}>{u.label}</Badge>
                <span className="font-mono text-xs text-foreground-muted">{product.code}</span>
              </div>
              <h3 className="mt-1.5 text-base font-semibold">
                <Link href={`/dashboard/inventory/${product.id}/edit`} className="hover:underline">
                  {product.name}
                </Link>
              </h3>
              <p className="text-xs text-foreground-muted">
                {[product.brand, product.category, product.vendor?.name].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="shrink-0 sm:text-right">
              <p className="text-lg font-semibold tabular-nums">
                Order {line.quantity} {line.quantity === 1 ? unit : `${unit}s`}
              </p>
              <p className="text-xs text-foreground-muted">
                {line.cases ? `${plural(line.cases, "case")} · ` : ""}
                {product.unitCost > 0 ? `≈ ${money(line.cost)}` : "No unit cost set"}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Stock by location">
            {product.stocks.map((s) => {
              const low = s.reorderPoint > 0 && s.onHand <= s.reorderPoint;
              return (
                <span
                  key={s.locationName}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-xs",
                    low ? "border-status-warn/40 text-status-warn" : "border-border-hairline text-foreground-muted",
                  )}
                >
                  {s.locationName} <span className="font-medium tabular-nums">{s.onHand}</span>
                  {s.reorderPoint > 0 && <span className="opacity-70"> / {s.reorderPoint}</span>}
                </span>
              );
            })}
          </div>

          <div id={whyId} className="mt-4 rounded-lg border-l-2 border-brand/60 bg-surface-raised/50 px-3 py-2.5">
            <h4 className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
              Why the engine suggests this
            </h4>
            <ul className="mt-1.5 flex list-disc flex-col gap-0.5 pl-4 text-xs text-foreground-muted marker:text-brand-light">
              {line.why.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        </article>
      </Card>
    </li>
  );
}
