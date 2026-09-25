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
