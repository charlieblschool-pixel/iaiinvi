"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
  name: string;
  unitLabel: string;
  autoReorder: boolean;
  brand: string;
  stock: BoardStock[];
};

export function InventoryBoard({
  locations,
  brands,
}: {
  locations: BoardLocation[];
  brands: { name: string; products: BoardProduct[] }[];
}) {
  const [activeLocationIds, setActiveLocationIds] = useState<Set<string>>(
    () => new Set(locations.map((l) => l.id)),
  );
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const visibleLocations = locations.filter((l) => activeLocationIds.has(l.id));
  const allSelected = activeLocationIds.size === locations.length;

  function toggleLocation(id: string) {
    setActiveLocationIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllLocations() {
    setActiveLocationIds(new Set(locations.map((l) => l.id)));
  }

  function toggleBrand(name: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const visibleBrands = useMemo(() => {
    return brands
      .map((brand) => ({
        ...brand,
        products: brand.products.filter((p) =>
          p.stock.some((s) => activeLocationIds.has(s.locationId)),
        ),
      }))
      .filter((brand) => brand.products.length > 0);
  }, [brands, activeLocationIds]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
          Filter locations
        </span>
        <button
          onClick={selectAllLocations}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            allSelected
              ? "border-brand bg-brand/10 text-brand-light"
              : "border-border-hairline text-foreground-muted hover:border-foreground-muted",
          )}
        >
          All
        </button>
        {locations.map((location) => {
          const active = activeLocationIds.has(location.id);
          return (
            <button
              key={location.id}
              onClick={() => toggleLocation(location.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-brand bg-brand/10 text-brand-light"
                  : "border-border-hairline text-foreground-muted hover:border-foreground-muted",
              )}
            >
              {location.name}
            </button>
          );
        })}
      </div>

      {visibleBrands.length === 0 ? (
        <div className="rounded-2xl border border-border-hairline bg-surface px-6 py-16 text-center">
          <p className="text-foreground-muted">
            No products in the selected locations.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border-hairline bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-foreground-muted">
                  <th className="px-6 py-3 font-medium">Product</th>
                  {visibleLocations.map((location) => (
                    <th key={location.id} className="px-4 py-3 text-right font-medium">
                      {location.name}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Auto-reorder</th>
                </tr>
              </thead>
              <tbody>
                {visibleBrands.map((brand) => {
                  const isCollapsed = collapsed.has(brand.name);
                  return (
                    <BrandGroup
                      key={brand.name}
                      brand={brand}
                      visibleLocations={visibleLocations}
                      isCollapsed={isCollapsed}
                      onToggle={() => toggleBrand(brand.name)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function BrandGroup({
  brand,
  visibleLocations,
  isCollapsed,
  onToggle,
}: {
  brand: { name: string; products: BoardProduct[] };
  visibleLocations: BoardLocation[];
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const colSpan = 4 + visibleLocations.length;

  return (
    <>
      <tr className="border-t border-border-hairline bg-surface-raised/40">
        <td colSpan={colSpan} className="px-6 py-2">
          <button
            onClick={onToggle}
            className="flex w-full items-center gap-2 text-left text-xs font-medium uppercase tracking-wider text-brand-light"
          >
            <span
              className={cn(
                "inline-block transition-transform",
                isCollapsed ? "-rotate-90" : "rotate-0",
              )}
            >
              ▾
            </span>
            {brand.name}
            <span className="font-normal normal-case text-foreground-muted">
              ({brand.products.length} product{brand.products.length === 1 ? "" : "s"})
            </span>
          </button>
        </td>
      </tr>
      {!isCollapsed &&
        brand.products.map((product) => {
          const totalOnHand = product.stock
            .filter((s) => visibleLocations.some((l) => l.id === s.locationId))
            .reduce((sum, s) => sum + s.onHand, 0);
          const totalReorderPoint = product.stock
            .filter((s) => visibleLocations.some((l) => l.id === s.locationId))
            .reduce((sum, s) => sum + s.reorderPoint, 0);
          const status = stockStatus(totalOnHand, totalReorderPoint);

          return (
            <tr key={product.id} className="border-t border-border-hairline">
              <td className="px-6 py-3">{product.name}</td>
              {visibleLocations.map((location) => {
                const stock = product.stock.find((s) => s.locationId === location.id);
                return (
                  <td
                    key={location.id}
                    className="px-4 py-3 text-right text-foreground-muted"
                  >
                    {stock ? stock.onHand : "—"}
                  </td>
                );
              })}
              <td className="px-4 py-3 text-right font-medium">
                {totalOnHand} {product.unitLabel}
                {totalOnHand === 1 ? "" : "s"}
              </td>
              <td className="px-6 py-3">
                <Badge tone={status.tone}>{status.label}</Badge>
              </td>
              <td className="px-6 py-3">
                <AutoReorderToggle
                  productId={product.id}
                  productName={product.name}
                  initialValue={product.autoReorder}
                />
              </td>
            </tr>
          );
        })}
    </>
  );
}
