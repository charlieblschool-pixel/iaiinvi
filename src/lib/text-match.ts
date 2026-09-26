// Small string helpers shared by the spreadsheet importer, location matching,
// and category detection. Pure — safe to import on the client and server.

/** Optimal-string-alignment distance (Levenshtein + adjacent transpositions). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** Lowercase, unify dashes/quotes, collapse whitespace. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Key used to decide whether two product names are "the same product". */
export function productNameKey(name: string): string {
  return normalizeText(name)
    .replace(/[^a-z0-9%./+& ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SMALL_WORDS = new Set(["a", "an", "and", "at", "for", "in", "of", "on", "or", "the", "to", "by"]);

/**
 * Title-cases text typed in ALL CAPS, all lowercase, or sentence case ("TOP OF
 * RETAIL SHELF", "Retail drawer" → "Top of Retail Shelf", "Retail Drawer").
 * Deliberately mixed case ("iPad Stand", "Top Shelf") is left as typed.
 */
export function tidyCase(value: string): string {
  const letters = value.replace(/[^a-zA-Z]/g, "");
  if (!letters) return value;
  const isAllUpper = letters === letters.toUpperCase();
  const isAllLower = letters === letters.toLowerCase();
  const isSentence =
    letters[0] === letters[0].toUpperCase() && letters.slice(1) === letters.slice(1).toLowerCase();
  if (!isAllUpper && !isAllLower && !isSentence) return value;
  return value
    .toLowerCase()
    .split(" ")
    .map((word, i) =>
      i > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

/**
 * Parses a spreadsheet number: "12", "1,200", "$4.50", "(3)", "12 ea".
 * Returns undefined for blanks and non-numbers ("n/a", "-").
 */
export function parseLooseNumber(raw: string | undefined | null): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  let value = String(raw).trim();
  if (!value) return undefined;
  let negative = false;
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1);
  }
  value = value.replace(/[$€£,\s]/g, "");
  const match = value.match(/^-?\d*\.?\d+/);
  if (!match) return undefined;
  const n = Number(match[0]);
  if (!Number.isFinite(n)) return undefined;
  return negative ? -n : n;
}

/** True when the cell is a plain number (used to detect quantity columns). */
export function isStrictNumber(raw: string): boolean {
  return /^\(?\s*[$€£]?\s*-?[\d,]*\.?\d+\s*\)?$/.test(raw.trim());
}

const UNICODE_FRACTIONS: Record<string, number> = {
  "¼": 0.25, "½": 0.5, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125,
};

export type ParsedCount = { value: number; inCases: boolean };

/**
 * Reads a stock count the way people actually write them:
 *   "12", "1,200", "3+2" (counted in two spots), "1/2" or "½" (half a bottle),
 *   "1 1/2", "4 btl", "6 ea", "2 cases" / "2 cs" (multiplied by case pack later).
 * Returns undefined for anything that isn't a count ("n/a", "?", "x").
 */
export function parseCount(raw: string | undefined | null): ParsedCount | undefined {
  if (raw === undefined || raw === null) return undefined;
  let text = String(raw).trim().toLowerCase();
  if (!text) return undefined;
  for (const [glyph, n] of Object.entries(UNICODE_FRACTIONS)) {
    text = text.replace(new RegExp(`(\\d)?\\s*${glyph}`), (_, whole) => ` ${(whole ? Number(whole) : 0) + n}`);
  }
  const inCases = /\b(cases?|cs|cse|bx|boxes?)\b/.test(text);
  text = text
    .replace(/\b(cases?|cs|cse|bx|boxes?|bottles?|btls?|ea|each|units?|pcs?|pieces?|tubes?|jars?|cans?|pk|packs?)\b\.?/g, " ")
    .replace(/[,$]/g, "")
    .trim();

  // Sums: "3+2", "3 + 2 + 1"
  if (/^[\d.\s/]+(\+[\d.\s/]+)+$/.test(text)) {
    const parts = text.split("+").map((p) => parseCount(p)?.value);
    if (parts.every((p) => p !== undefined)) {
      return { value: parts.reduce((a, b) => a! + b!, 0)!, inCases };
    }
  }
  // Mixed fraction "1 1/2" or simple "1/2"
  const fraction = text.match(/^(\d+)?\s*(\d+)\s*\/\s*(\d+)$/);
  if (fraction && Number(fraction[3]) !== 0) {
    return { value: Number(fraction[1] ?? 0) + Number(fraction[2]) / Number(fraction[3]), inCases };
  }
  const n = parseLooseNumber(text);
  return n === undefined ? undefined : { value: n, inCases };
}
