"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AutoReorderToggle } from "@/components/dashboard/auto-reorder-toggle";
import { stockStatus } from "@/lib/inventory";
import { cn } from "@/lib/cn";

export type BoardLocation = {
  id: string;
  name: string;
};

export type BoardStock = {
  locationId: string;
  onHand: number;
  reorderPoint: number;
};

export type BoardProduct = {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  sku: string | null;
  unitLabel: string;
  autoReorder: boolean;
  category: string;
  stock: BoardStock[];
};

export type BoardGroup = { name: string; products: BoardProduct[] };

function totals(product: BoardProduct, locationIds: Set<string>) {
  const stock = product.stock.filter((s) => locationIds.has(s.locationId));
  return {
    counted: stock.length > 0,
    onHand: stock.reduce((sum, s) => sum + s.onHand, 0),
    reorderPoint: stock.reduce((sum, s) => sum + s.reorderPoint, 0),
  };
}

export function InventoryBoard({
  locations,
  groups,
}: {
  locations: BoardLocation[];
  groups: BoardGroup[];
}) {
  const [activeLocationIds, setActiveLocationIds] = useState<Set<string>>(
    () => new Set(locations.map((l) => l.id)),
  );
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const visibleLocations = locations.filter((l) => activeLocationIds.has(l.id));
  const allSelected = activeLocationIds.size === locations.length;

  function toggleLocation(id: string) {
    setActiveLocationIds((prev) => {
      // From "All", clicking a location shows just that one.
      if (prev.size === locations.length) return new Set([id]);
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next.size === 0 ? new Set(locations.map((l) => l.id)) : next;
    });
  }

  function toggleGroup(name: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .filter((g) => !activeGroup || g.name === activeGroup)
      .map((group) => ({
        ...group,
        products: group.products.filter((p) => {
          if (!allSelected && !p.stock.some((s) => activeLocationIds.has(s.locationId))) return false;
          if (q) {
            const haystack = `${p.name} ${p.code} ${p.brand ?? ""} ${p.sku ?? ""}`.toLowerCase();
            if (!haystack.includes(q)) return false;
          }
          if (lowOnly) {
            const t = totals(p, activeLocationIds);
            if (!t.counted || stockStatus(t.onHand, t.reorderPoint).tone === "good") return false;
          }
          return true;
        }),
      }))
      .filter((g) => g.products.length > 0);
  }, [groups, activeGroup, activeLocationIds, allSelected, query, lowOnly]);

  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150 active:scale-95",
      active
        ? "border-brand bg-brand/10 text-brand-light"
        : "border-border-hairline text-foreground-muted hover:border-white/40 hover:text-foreground",
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setActiveGroup(null)} className={chip(activeGroup === null)}>
            All products
          </button>
          {groups.map((g) => (
            <button
              key={g.name}
              onClick={() => setActiveGroup(activeGroup === g.name ? null : g.name)}
              className={chip(activeGroup === g.name)}
            >
              {g.name} <span className="opacity-70">{g.products.length}</span>
            </button>
          ))}
          <button onClick={() => setLowOnly((v) => !v)} className={chip(lowOnly)}>
            Low or out of stock
          </button>
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, code, brand, SKU"
          className="h-9 sm:w-72"
          type="search"
        />
      </div>

      {locations.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
            Locations
          </span>
          <button
            onClick={() => setActiveLocationIds(new Set(locations.map((l) => l.id)))}
            className={chip(allSelected)}
          >
            All
          </button>
          {locations.map((location) => (
            <button
              key={location.id}
              onClick={() => toggleLocation(location.id)}
              className={chip(!allSelected && activeLocationIds.has(location.id))}
            >
              {location.name}
            </button>
          ))}
        </div>
      )}

      {visibleGroups.length === 0 ? (
        <div className="rounded-2xl border border-border-hairline bg-surface px-6 py-16 text-center">
          <p className="text-foreground-muted">No products match these filters.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border-hairline bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-foreground-muted">
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Product</th>
                  {visibleLocations.map((location) => (
                    <th key={location.id} className="whitespace-nowrap px-4 py-3 text-right font-medium">
                      {location.name}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Auto-reorder</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {visibleGroups.map((group) => (
                  <Group
                    key={group.name}
                    group={group}
                    visibleLocations={visibleLocations}
                    activeLocationIds={activeLocationIds}
                    isCollapsed={collapsed.has(group.name)}
                    onToggle={() => toggleGroup(group.name)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Group({
  group,
  visibleLocations,
  activeLocationIds,
  isCollapsed,
  onToggle,
}: {
  group: BoardGroup;
  visibleLocations: BoardLocation[];
  activeLocationIds: Set<string>;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const colSpan = 6 + visibleLocations.length;

  return (
    <>
      <tr className="border-t border-border-hairline bg-surface-raised/40">
        <td colSpan={colSpan} className="px-4 py-2">
          <button
            onClick={onToggle}
            className="flex w-full items-center gap-2 text-left text-xs font-medium uppercase tracking-wider text-brand-light"
          >
            <span className={cn("inline-block transition-transform", isCollapsed ? "-rotate-90" : "rotate-0")}>
              ▾
            </span>
            {group.name}
            <span className="font-normal normal-case text-foreground-muted">
              ({group.products.length} product{group.products.length === 1 ? "" : "s"})
            </span>
          </button>
        </td>
      </tr>
      {!isCollapsed &&
        group.products.map((product) => {
          const t = totals(product, activeLocationIds);
          const status = t.counted ? stockStatus(t.onHand, t.reorderPoint) : null;

          return (
            <tr key={product.id} className="border-t border-border-hairline">
              <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-foreground-muted">
                {product.code}
              </td>
              <td className="min-w-48 px-4 py-3">
                <p>{product.name}</p>
                {product.brand && <p className="text-xs text-foreground-muted">{product.brand}</p>}
              </td>
              {visibleLocations.map((location) => {
                const stock = product.stock.find((s) => s.locationId === location.id);
                const low = stock && stock.onHand <= stock.reorderPoint && stock.reorderPoint > 0;
                return (
                  <td
                    key={location.id}
                    className={cn(
                      "px-4 py-3 text-right tabular-nums",
                      low ? "text-status-warn" : "text-foreground-muted",
                    )}
                  >
                    {stock ? stock.onHand : "—"}
                  </td>
                );
              })}
              <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">
                {t.onHand} {product.unitLabel}
                {t.onHand === 1 ? "" : "s"}
              </td>
              <td className="px-4 py-3">
                {status ? <Badge tone={status.tone}>{status.label}</Badge> : <Badge>Not counted</Badge>}
              </td>
              <td className="px-4 py-3">
                <AutoReorderToggle
                  productId={product.id}
                  productName={product.name}
                  initialValue={product.autoReorder}
                />
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/dashboard/inventory/${product.id}/edit`}
                  className="text-sm text-brand-light hover:underline"
                >
                  Edit
                </Link>
              </td>
            </tr>
          );
        })}
    </>
  );
}
