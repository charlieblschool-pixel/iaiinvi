// Shared, client-safe helpers for Inventory → Track.

import { editDistance, productNameKey } from "@/lib/text-match";

export const MOVEMENT_TYPES = ["SOLD", "USED", "WASTED"] as const;
export type MovementKind = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_LABELS: Record<MovementKind, { label: string; past: string; hint: string }> = {
  SOLD: { label: "Sold", past: "sold", hint: "Sold to a client" },
  USED: { label: "Used", past: "used", hint: "Used on a client during a service" },
  WASTED: { label: "Wasted", past: "wasted", hint: "Spilled, expired, damaged or thrown out" },
};

export type TrackableProduct = {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  sku: string | null;
  category: string;
};

/**
 * Finds products for what someone typed or scanned. Exact code ("P-0012",
 * "p12", "12") or barcode/SKU matches come first, then names that start with
 * the text, then names containing every word, then close typos.
 */
export function searchProducts<T extends TrackableProduct>(query: string, products: T[], limit = 8): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const codeDigits = q.replace(/^p-?/, "").replace(/^0+/, "");
  const qKey = productNameKey(q);
  const words = qKey.split(" ").filter(Boolean);

  const scored: { product: T; score: number }[] = [];
  for (const product of products) {
    const code = product.code.toLowerCase();
    const name = productNameKey(product.name);
    const haystack = `${name} ${productNameKey(product.brand ?? "")}`;
    let score = 0;

    if (code === q || (/^\d+$/.test(codeDigits) && code.replace(/^p-0*/, "") === codeDigits && /^(p-?)?\d+$/.test(q))) {
      score = 1000;
    } else if (product.sku && product.sku.trim().toLowerCase() === q) {
      score = 900;
    } else if (name === qKey) {
      score = 800;
    } else if (name.startsWith(qKey)) {
      score = 700 - name.length / 100;
    } else if (words.length && words.every((w) => haystack.includes(w))) {
      score = 500 - name.length / 100;
    } else if (qKey.length >= 4) {
      // Typo tolerance per word: "shampo" → "shampoo", "condtioner" → "conditioner".
      const nameWords = haystack.split(" ");
      const matched = words.filter((w) =>
        nameWords.some((nw) => nw.startsWith(w) || (w.length >= 4 && editDistance(w, nw.slice(0, w.length + 1)) <= 1) || (w.length >= 5 && editDistance(w, nw) <= 2)),
      ).length;
      if (matched === words.length) score = 300;
      else if (matched > 0 && matched >= words.length - 1 && words.length > 1) score = 150;
    }

    if (score > 0) scored.push({ product, score });
  }
  // Loose partial matches only when nothing matched properly.
  const best = Math.max(0, ...scored.map((s) => s.score));
  return scored
    .filter((s) => best < 300 || s.score >= 300)
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name))
    .slice(0, limit)
    .map((s) => s.product);
}

/** Where to take stock from by default: the location holding the most. */
export function defaultLocationId(stocks: { locationId: string; onHand: number }[]): string | null {
  if (stocks.length === 0) return null;
  return [...stocks].sort((a, b) => b.onHand - a.onHand)[0].locationId;
}
