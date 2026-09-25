import { editDistance, normalizeText } from "@/lib/text-match";

// Every product is either used behind the chair (Backbar) or sold to
// clients (Retail). These are the two built-in categories; the importer
// reads them straight out of product names like "Blowout Creme - backbar".
export const BACKBAR = "Backbar";
export const RETAIL = "Retail";
export const USAGE_CATEGORIES = [BACKBAR, RETAIL] as const;
export type UsageCategory = (typeof USAGE_CATEGORIES)[number];

const CATEGORY_KEYWORDS: Record<UsageCategory, string[]> = {
  Backbar: [
    "backbar",
    "back bar",
    "bkbar",
    "bckbar",
    "professional",
    "professional use",
    "pro use",
    "salon use",
    "backbar size",
    "back of house",
  ],
  Retail: ["retail", "rtl", "resale", "for sale", "retail size", "retail item"],
};

function compact(value: string): string {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "");
}

/**
 * Returns Backbar/Retail when the whole text is one of the category words
 * (tolerating a one-letter typo like "retial" or "backbr"), otherwise null.
 */
export function matchUsageCategory(text: string | undefined | null): UsageCategory | null {
  if (!text) return null;
  const value = compact(text);
  if (!value) return null;
  for (const category of USAGE_CATEGORIES) {
    if (CATEGORY_KEYWORDS[category].some((kw) => compact(kw) === value)) return category;
  }
  if (value.length < 5 || value.length > 14) return null;
  for (const category of USAGE_CATEGORIES) {
    if (
      CATEGORY_KEYWORDS[category].some((kw) => {
        const k = compact(kw);
        return k.length >= 5 && editDistance(k, value) <= 1;
      })
    ) {
      return category;
    }
  }
  return null;
}

/** Case-insensitive match of an existing category name to Backbar/Retail. */
export function usageCategoryFromName(name: string | null | undefined): UsageCategory | null {
  if (!name) return null;
  const value = compact(name);
  return USAGE_CATEGORIES.find((c) => compact(c) === value) ?? null;
}

// Separators people put between a product name and its category:
// "Name - retail", "Name – retail", "Name | retail", "Name / retail",
// "Name: retail". A bare hyphen inside a word ("anti-frizz") is not a
// separator — it needs a space on at least one side.
const SEPARATOR = /\s*[–—|/:]+\s*|\s+-+\s*|\s*-+\s+|\s*-{2,}\s*/;

function tidyName(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—|/:,.]+|[\s\-–—|/:,]+$/g, "")
    .trim();
}

/**
 * Pulls a Backbar/Retail marker out of a product name.
 *   "Blowout Creme - backbar"  → { name: "Blowout Creme", category: "Backbar" }
 *   "Shampoo (Retail)"         → { name: "Shampoo", category: "Retail" }
 *   "RETAIL | Dry Shampoo"     → { name: "Dry Shampoo", category: "Retail" }
 *   "Shampoo retail"           → { name: "Shampoo", category: "Retail" }
 *   "Anti-Frizz Serum"         → { name: "Anti-Frizz Serum", category: null }
 */
export function splitCategoryFromName(raw: string): {
  name: string;
  category: UsageCategory | null;
} {
  const original = tidyName(raw);
  if (!original) return { name: "", category: null };

  // 1. Separated segments: "Name - backbar", "backbar - Name", "Name - backbar - 1L".
  const segments = original.split(SEPARATOR).map((s) => s.trim()).filter(Boolean);
  if (segments.length > 1) {
    let found: UsageCategory | null = null;
    const kept: string[] = [];
    for (const segment of segments) {
      const match = matchUsageCategory(segment.replace(/^[([{]+|[)\]}]+$/g, ""));
      if (match && !found) found = match;
      else if (!match) kept.push(segment);
    }
    if (found && kept.length > 0) {
      return { name: tidyName(kept.join(" - ")), category: found };
    }
  }

  // 2. Parenthetical: "Shampoo (retail)", "[Backbar] Shampoo".
  const trailing = original.match(/^(.*?)\s*[([{]\s*([^()[\]{}]+?)\s*[)\]}]\s*$/);
  if (trailing) {
    const match = matchUsageCategory(trailing[2]);
    if (match && tidyName(trailing[1])) return { name: tidyName(trailing[1]), category: match };
  }
  const leading = original.match(/^\s*[([{]\s*([^()[\]{}]+?)\s*[)\]}]\s*(.*)$/);
  if (leading) {
    const match = matchUsageCategory(leading[1]);
    if (match && tidyName(leading[2])) return { name: tidyName(leading[2]), category: match };
  }

  // 3. Trailing word with no separator: "Shampoo Retail", "Blowout Creme Back Bar".
  //    Exact words only — no typo tolerance without a separator.
  const words = original.split(" ");
  for (const take of [2, 1]) {
    if (words.length <= take) continue;
    const tail = words.slice(-take).join(" ");
    const normalizedTail = normalizeText(tail).replace(/[^a-z ]/g, "");
    const exact = USAGE_CATEGORIES.find((c) =>
      CATEGORY_KEYWORDS[c].some((kw) => kw === normalizedTail),
    );
    if (exact) {
      const rest = tidyName(words.slice(0, -take).join(" "));
      if (rest) return { name: rest, category: exact };
    }
  }

  return { name: original, category: null };
}
