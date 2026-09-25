// Decides, for each product parsed from a spreadsheet, whether it updates an
// existing product or creates a new one, and which spreadsheet locations are
// new. Pure — the import preview runs this in the browser and the server runs
// the exact same function when committing, so the preview never lies.

import { z } from "zod";
import {
  USAGE_CATEGORIES,
  splitCategoryFromName,
  usageCategoryFromName,
  type UsageCategory,
} from "@/lib/categories";
import { cleanLocationName, findLocationMatch, locationKey } from "@/lib/locations";
import { productNameKey } from "@/lib/text-match";

const stockSchema = z.object({
  location: z.string().trim().min(1).max(80),
  onHand: z.number().int().min(0).max(1_000_000).optional(),
  reorderPoint: z.number().int().min(0).max(1_000_000).optional(),
});

export const importProductSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.enum(USAGE_CATEGORIES).nullable(),
  brand: z.string().trim().max(100).optional(),
  vendor: z.string().trim().max(100).optional(),
  unit: z.string().trim().max(40).optional(),
  casePackSize: z.number().int().min(1).max(10_000).optional(),
  unitCost: z.number().min(0).max(1_000_000).optional(),
  sku: z.string().trim().max(80).optional(),
  code: z.string().trim().max(20).optional(),
  stocks: z.array(stockSchema).max(200),
});

export type ImportProduct = z.infer<typeof importProductSchema>;

export type ExistingLocation = { id: string; name: string };
export type ExistingProduct = {
  id: string;
  code: string;
  name: string;
  categoryName: string | null;
  sku: string | null;
};

export type ProductPlan = {
  action: "create" | "update";
  existingId?: string;
  existingCode?: string;
  existingName?: string;
  /** Set when the stored name still has "- backbar" etc. baked into it. */
  rename?: string;
  matchedBy?: "code" | "sku" | "name";
};

export type LocationPlan = {
  /** Name as written in the spreadsheet (after cleanup). */
  label: string;
  existingId?: string;
  /** The name that will be used — the existing location's, or the new one. */
  name: string;
  isNew: boolean;
};

export type ImportPlan = {
  products: ProductPlan[];
  locations: LocationPlan[];
  /** Spreadsheet location label key → resolved location name. */
  locationFor: Map<string, LocationPlan>;
};

function effectiveCategory(p: ExistingProduct): UsageCategory | null {
  return usageCategoryFromName(p.categoryName) ?? splitCategoryFromName(p.name).category;
}

export function planImport(
  products: Pick<ImportProduct, "name" | "category" | "code" | "sku" | "stocks">[],
  existing: { locations: ExistingLocation[]; products: ExistingProduct[] },
): ImportPlan {
  // ----- Locations -----
  const locationFor = new Map<string, LocationPlan>();
  const locations: LocationPlan[] = [];
  const pool: { name: string; plan: LocationPlan }[] = existing.locations.map((l) => ({
    name: l.name,
    plan: { label: l.name, existingId: l.id, name: l.name, isNew: false },
  }));
  for (const product of products) {
    for (const stock of product.stocks) {
      const label = cleanLocationName(stock.location);
      const key = locationKey(label);
      if (!key || locationFor.has(key)) continue;
      const match = findLocationMatch(label, pool);
      const plan: LocationPlan = match
        ? { ...match.plan, label }
        : { label, name: label, isNew: true };
      if (!match) pool.push({ name: label, plan });
      locationFor.set(key, plan);
      if (!locations.some((l) => l.name === plan.name)) locations.push(plan);
    }
  }

  // ----- Products -----
  const byCode = new Map<string, ExistingProduct>();
  const bySku = new Map<string, ExistingProduct[]>();
  const byName = new Map<string, { product: ExistingProduct; category: UsageCategory | null }[]>();
  for (const p of existing.products) {
    byCode.set(p.code.toUpperCase(), p);
    if (p.sku) {
      const k = p.sku.trim().toLowerCase();
      bySku.set(k, [...(bySku.get(k) ?? []), p]);
    }
    const nameKey = productNameKey(splitCategoryFromName(p.name).name);
    byName.set(nameKey, [...(byName.get(nameKey) ?? []), { product: p, category: effectiveCategory(p) }]);
  }

  const claimed = new Set<string>();
  const plans: ProductPlan[] = products.map((row) => {
    const nameKey = productNameKey(row.name);
    const sameName = (byName.get(nameKey) ?? []).filter((c) => !claimed.has(c.product.id));

    let match: ExistingProduct | undefined;
    let matchedBy: ProductPlan["matchedBy"];

    const byCodeMatch = row.code ? byCode.get(row.code.toUpperCase()) : undefined;
    if (byCodeMatch && !claimed.has(byCodeMatch.id)) {
      match = byCodeMatch;
      matchedBy = "code";
    }
    if (!match && row.sku) {
      const candidates = (bySku.get(row.sku.trim().toLowerCase()) ?? []).filter(
        (p) => !claimed.has(p.id) && (!row.category || !effectiveCategory(p) || effectiveCategory(p) === row.category),
      );
      if (candidates.length === 1) {
        match = candidates[0];
        matchedBy = "sku";
      }
    }
    if (!match) {
      const exact = sameName.find((c) => c.category === row.category);
      // Same name, no category yet — adopt it rather than creating a twin.
      const uncategorized = sameName.filter((c) => c.category === null);
      const found =
        exact?.product ??
        (row.category && uncategorized.length === 1 ? uncategorized[0].product : undefined) ??
        (!row.category && sameName.length === 1 ? sameName[0].product : undefined);
      if (found) {
        match = found;
        matchedBy = "name";
      }
    }

    if (!match) return { action: "create" };
    claimed.add(match.id);
    const storedSplit = splitCategoryFromName(match.name);
    return {
      action: "update",
      existingId: match.id,
      existingCode: match.code,
      existingName: match.name,
      // Rename when the stored name still carries "- backbar", or when the
      // sheet was matched by code (it's the source of truth for the name).
      rename:
        (storedSplit.category || matchedBy === "code") && row.name !== match.name
          ? row.name
          : undefined,
      matchedBy,
    };
  });

  return { products: plans, locations, locationFor };
}

export function resolveLocation(plan: ImportPlan, label: string): LocationPlan | undefined {
  return plan.locationFor.get(locationKey(cleanLocationName(label)));
}
