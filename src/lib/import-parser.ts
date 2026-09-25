// Turns a raw spreadsheet (rows of cells) into a clean list of products, each
// with a Backbar/Retail category and stock per location. Pure and
// synchronous so the import screen can re-run it instantly on every tweak.
//
// Spreadsheet shapes it understands (and any mix of them):
//   • Category in the product name:   "Blowout Creme - backbar", "Shampoo (retail)"
//   • One quantity column per place:  Product | Top of Retail Shelf | Retail Drawer | Floor
//   • A Location column:              Product | Location | Qty
//   • Section heading rows:           "TOP OF RETAIL SHELF -----" followed by its products
//   • Title rows above the header, repeated headers, blank and "-----" rows, totals

import {
  BACKBAR,
  RETAIL,
  matchUsageCategory,
  splitCategoryFromName,
  type UsageCategory,
} from "@/lib/categories";
import { cleanLocationName, locationKey } from "@/lib/locations";
import {
  isStrictNumber,
  normalizeText,
  parseLooseNumber,
  productNameKey,
} from "@/lib/text-match";

export type SheetRows = string[][];

export const FIELD_KEYS = [
  "name",
  "category",
  "location",
  "quantity",
  "reorderPoint",
  "brand",
  "vendor",
  "unit",
  "casePackSize",
  "unitCost",
  "sku",
  "code",
] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

export const FIELD_LABELS: Record<FieldKey, string> = {
  name: "Product name",
  category: "Backbar / Retail",
  location: "Location",
  quantity: "Quantity on hand",
  reorderPoint: "Reorder point / par",
  brand: "Brand",
  vendor: "Vendor / supplier",
  unit: "Unit (bottle, tube…)",
  casePackSize: "Case pack size",
  unitCost: "Unit cost",
  sku: "Vendor SKU / UPC",
  code: "invii code (P-0001)",
};

export type LocationColumn = {
  column: number;
  location: string;
  kind: "onHand" | "reorderPoint";
};
export type CategoryColumn = { column: number; category: UsageCategory };

export type ColumnMapping = {
  /** Index of the header row, or -1 when the sheet has no header row. */
  headerRow: number;
  fields: Partial<Record<FieldKey, number>>;
  locationColumns: LocationColumn[];
  categoryColumns: CategoryColumn[];
};

export type ParseOptions = {
  /** Where products go when the sheet doesn't say. */
  defaultLocation: string;
  /** Category chosen in the review screen for specific products (by name key). */
  categoryOverrides?: Record<string, UsageCategory>;
  /** Spreadsheet row numbers the user said are products, not section headings. */
  notSectionRows?: number[];
};

export type ParsedStock = { location: string; onHand?: number; reorderPoint?: number };

export type CategorySource = "name" | "column" | "section" | "manual";

export type ParsedProduct = {
  /** productNameKey(name) + "|" + category — unique within one import. */
  key: string;
  /** productNameKey(name) — what category overrides are keyed by. */
  nameKey: string;
  name: string;
  category: UsageCategory | null;
  categorySource: CategorySource | null;
  brand?: string;
  vendor?: string;
  unit?: string;
  casePackSize?: number;
  unitCost?: number;
  sku?: string;
  code?: string;
  stocks: ParsedStock[];
  rows: number[];
};

export type ParseIssue = { row: number; message: string };

export type SectionHeading = { row: number; text: string; location?: string; category?: UsageCategory };

export type ParseResult = {
  products: ParsedProduct[];
  /** Location names in the order they first appear. */
  locations: string[];
  sections: SectionHeading[];
  skipped: ParseIssue[];
  notes: ParseIssue[];
  usedDefaultLocation: boolean;
};

// ---------- Header detection & column guessing ----------

type Matcher = (header: string) => boolean;

const has = (...words: string[]): Matcher => (h) => words.some((w) => h.includes(w));
const exactly = (...words: string[]): Matcher => (h) => words.includes(h);

const QUANTITY_WORDS = [
  "on hand",
  "onhand",
  "qty",
  "quantity",
  "stock",
  "count",
  "inventory",
  "units",
  "available",
  "balance",
  "amount",
  "total",
];
const REORDER_WORDS = ["reorder", "re-order", "par", "min", "minimum", "threshold", "restock"];

// Checked in this order so e.g. "Product Code" becomes code, not name.
const FIELD_MATCHERS: [FieldKey, Matcher][] = [
  ["code", (h) => exactly("code", "invii code", "product code", "invii #", "invii id")(h)],
  [
    "sku",
    has("sku", "upc", "barcode", "bar code", "item #", "item no", "item number", "part #", "part number", "ean", "gtin", "vendor code", "item code"),
  ],
  ["unitCost", (h) => has("cost", "wholesale", "net price", "unit price")(h) || (exactly("price")(h))],
  ["casePackSize", (h) => has("case", "pack", "per box", "pk")(h) && !has("price", "cost")(h)],
  ["reorderPoint", (h) => REORDER_WORDS.some((w) => new RegExp(`\\b${w}\\b`).test(h))],
  ["vendor", has("vendor", "supplier", "distributor", "distributer", "purchased from", "bought from", "source")],
  ["brand", has("brand", "manufacturer", "mfr", "product line", "collection", "maker")],
  ["unit", (h) => exactly("unit", "units of measure", "uom", "unit type", "container", "unit label", "u/m")(h)],
  ["location", has("location", "loc", "area", "where", "storage", "section", "placement", "spot", "zone", "room", "shelf", "place")],
  [
    "category",
    (h) =>
      has("category", "usage", "dept", "department", "class", "backbar/retail", "retail/backbar", "use type")(h) ||
      exactly("type", "group", "kind", "use")(h),
  ],
  ["quantity", (h) => QUANTITY_WORDS.some((w) => h.includes(w)) && !has("price", "cost", "value", "$", "sold", "used")(h)],
  ["name", has("product", "item", "name", "description", "desc", "title")],
];

const NUMERIC_FIELDS = new Set<FieldKey>(["quantity", "reorderPoint", "casePackSize", "unitCost"]);
const TEXT_FIELDS = new Set<FieldKey>(["name", "location", "brand", "vendor", "unit", "category"]);

// Numeric columns with these words are never treated as a location.
const NOT_A_LOCATION = [
  "price",
  "cost",
  "msrp",
  "value",
  "total",
  "size",
  "oz",
  "ml",
  "liter",
  "litre",
  "weight",
  "sold",
  "sales",
  "usage",
  "used",
  "year",
  "date",
  "%",
  "margin",
  "markup",
  "max",
  "maximum",
  "id",
  "#",
  "$",
  "week",
  "month",
  "avg",
  "average",
  "lead",
  "days",
];

function isNotALocation(header: string): boolean {
  return NOT_A_LOCATION.some((w) =>
    w.length <= 2 ? header.split(/[\s()]+/).includes(w) : header.includes(w),
  );
}

// Words that, on their own, just mean "how many" ("Qty On Hand", "In Stock").
const QTY_FILLER = new Set([
  ...QUANTITY_WORDS.flatMap((w) => w.split(" ")),
  "in",
  "on",
  "hand",
  "current",
  "available",
  "of",
  "the",
  "#",
  "no",
  "number",
  "level",
  "levels",
  "qty",
]);

function headerKey(value: string): string {
  return normalizeText(value).replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
}

function cell(row: string[] | undefined, index: number | undefined): string {
  if (!row || index === undefined || index < 0) return "";
  return (row[index] ?? "").toString().trim();
}

const DECORATION = /^[\s\-=_*~#.•·|+]+$/;

function isBlank(value: string): boolean {
  return !value || DECORATION.test(value);
}

function columnCount(rows: SheetRows): number {
  return rows.reduce((max, r) => Math.max(max, r.length), 0);
}

export function columnLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Header text for a column (or "Column C" when the sheet has no header row). */
export function columnName(rows: SheetRows, mapping: Pick<ColumnMapping, "headerRow">, index: number): string {
  const header = mapping.headerRow >= 0 ? cell(rows[mapping.headerRow], index) : "";
  return header || `Column ${columnLetter(index)}`;
}

function headerScore(row: string[]): number {
  let score = 0;
  for (const raw of row) {
    const h = headerKey(raw ?? "");
    if (!h || isStrictNumber(h)) continue;
    if (FIELD_MATCHERS.some(([, match]) => match(h))) score += 1;
  }
  return score;
}

export function detectHeaderRow(rows: SheetRows): number {
  let best = -1;
  let bestScore = 0;
  const limit = Math.min(rows.length, 25);
  for (let i = 0; i < limit; i++) {
    const nonEmpty = rows[i].filter((c) => !isBlank(c ?? ""));
    if (nonEmpty.length < 2) continue;
    const score = headerScore(rows[i]);
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  if (best >= 0) return best;
  // No recognizable header words — use the first row with 2+ cells unless it
  // already looks like data (has numbers in it).
  for (let i = 0; i < limit; i++) {
    const nonEmpty = rows[i].filter((c) => !isBlank(c ?? ""));
    if (nonEmpty.length < 2) continue;
    return nonEmpty.some((c) => isStrictNumber(c)) ? -1 : i;
  }
  return -1;
}

type ColumnStats = { nonEmpty: number; numeric: number; distinct: number };

function columnStats(rows: SheetRows, headerRow: number): ColumnStats[] {
  const cols = columnCount(rows);
  const stats: ColumnStats[] = Array.from({ length: cols }, () => ({ nonEmpty: 0, numeric: 0, distinct: 0 }));
  const seen: Set<string>[] = Array.from({ length: cols }, () => new Set());
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    // Ignore single-cell rows (section headings) when profiling columns.
    if (row.filter((c) => !isBlank(c ?? "")).length < 2) continue;
    for (let c = 0; c < cols; c++) {
      const value = cell(row, c);
      if (isBlank(value)) continue;
      stats[c].nonEmpty += 1;
      if (isStrictNumber(value)) stats[c].numeric += 1;
      seen[c].add(value.toLowerCase());
    }
  }
  seen.forEach((s, c) => (stats[c].distinct = s.size));
  return stats;
}

const numericRatio = (s: ColumnStats) => (s.nonEmpty ? s.numeric / s.nonEmpty : 0);

function stripWords(header: string, words: string[]): string {
  let out = ` ${header} `;
  for (const w of words) {
    out = out.replace(new RegExp(`[\\s(\\[\\-–—:/]+${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s)\\]\\-–—:/]+`, "g"), " ");
  }
  return out.replace(/\s+/g, " ").trim();
}

/**
 * Removes one quantity word from the end (or start) of a header, so
 * "Floor Qty" → "floor" but "Mobile / Van Stock Qty" keeps "stock".
 */
function stripAffix(header: string, words: string[]): string {
  const sorted = [...words].sort((a, b) => b.length - a.length);
  for (const w of sorted) {
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const suffix = new RegExp(`[\\s(\\[\\-–—:/]+\\(?${esc}\\)?\\s*$`, "i");
    if (suffix.test(header)) return header.replace(suffix, "").trim();
  }
  for (const w of sorted) {
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const prefix = new RegExp(`^\\s*${esc}[\\s)\\]\\-–—:/]+`, "i");
    if (prefix.test(header)) return header.replace(prefix, "").trim();
  }
  return sorted.some((w) => header.trim().toLowerCase() === w) ? "" : header.trim();
}

const LOCATION_QTY_WORDS = ["on hand", "onhand", "qty", "quantity", "stock", "count", "inventory", "units", "amount", "#", "current"];
const LOCATION_RP_WORDS = ["reorder point", "reorder pt", "reorder", "re-order", "par level", "par", "min", "minimum", "threshold", "restock at"];

/** Auto-detects which spreadsheet column holds what. */
export function guessMapping(rows: SheetRows, knownLocations: string[] = []): ColumnMapping {
  const knownByKey = new Map(knownLocations.map((name) => [locationKey(name), name]));
  // Header → location label: an existing location's exact name wins, else
  // drop one quantity word ("Floor Qty" → "Floor").
  const locationLabel = (header: string) =>
    knownByKey.get(locationKey(header)) ?? stripAffix(header, LOCATION_QTY_WORDS);
  const headerRow = detectHeaderRow(rows);
  const headers = headerRow >= 0 ? rows[headerRow].map((h) => headerKey(h ?? "")) : [];
  const stats = columnStats(rows, headerRow);
  const cols = stats.length;
  const fields: Partial<Record<FieldKey, number>> = {};
  const used = new Set<number>();

  // "Floor Par" / "Cabinet reorder pt" next to a "Floor" / "Cabinet" column is
  // that location's reorder point — hold those back from the global fields.
  const perLocationRp = new Map<number, number>();
  if (headerRow >= 0) {
    for (let c = 0; c < cols; c++) {
      const h = headers[c];
      if (!h) continue;
      const remainder = stripWords(h, LOCATION_RP_WORDS);
      if (remainder === h || !locationKey(remainder)) continue;
      const target = headers.findIndex(
        (other, d) => d !== c && other && locationKey(locationLabel(other)) === locationKey(remainder),
      );
      if (target >= 0) {
        perLocationRp.set(c, target);
        used.add(c);
      }
    }
  }

  // "Floor Qty" / "Cabinet Count" / an existing location's exact name are
  // per-location quantity columns — keep them away from the single global
  // "quantity" field so the first one doesn't swallow the rest.
  const perLocationQty = new Set<number>();
  if (headerRow >= 0) {
    for (let c = 0; c < cols; c++) {
      const h = headers[c];
      if (!h || used.has(c) || stats[c].nonEmpty === 0 || numericRatio(stats[c]) < 0.7) continue;
      if (knownByKey.has(locationKey(h))) {
        perLocationQty.add(c);
        continue;
      }
      const label = locationLabel(h);
      if (!label || label.toLowerCase() === h) continue;
      const words = normalizeText(label).split(/[^a-z0-9#]+/).filter(Boolean);
      if (words.every((w) => QTY_FILLER.has(w))) continue;
      if (isNotALocation(h)) continue;
      perLocationQty.add(c);
    }
    perLocationQty.forEach((c) => used.add(c));
  }

  if (headerRow >= 0) {
    for (const [field, match] of FIELD_MATCHERS) {
      for (let c = 0; c < cols; c++) {
        if (used.has(c) || fields[field] !== undefined) continue;
        const h = headers[c];
        if (!h || !match(h)) continue;
        const s = stats[c];
        if (NUMERIC_FIELDS.has(field) && s.nonEmpty > 0 && numericRatio(s) < 0.6) continue;
        if (TEXT_FIELDS.has(field) && s.nonEmpty > 0 && numericRatio(s) > 0.5) continue;
        // A "Shelf"-style header full of numbers is a quantity-per-location
        // column, not a column of location names.
        if (field === "location" && s.nonEmpty === 0) continue;
        fields[field] = c;
        used.add(c);
      }
    }
  }

  // No name header? Use the text column with the most distinct values.
  if (fields.name === undefined) {
    let best = -1;
    for (let c = 0; c < cols; c++) {
      if (used.has(c) || numericRatio(stats[c]) > 0.3 || stats[c].nonEmpty === 0) continue;
      if (best < 0 || stats[c].distinct > stats[best].distinct) best = c;
    }
    if (best >= 0) {
      fields.name = best;
      used.add(best);
    }
  }

  const locationColumns: LocationColumn[] = [];
  const categoryColumns: CategoryColumn[] = [];

  if (headerRow >= 0) {
    for (let c = 0; c < cols; c++) {
      if (used.has(c) && !perLocationQty.has(c)) continue;
      const raw = cell(rows[headerRow], c);
      const h = headers[c];
      const s = stats[c];
      if (!h || isStrictNumber(h) || s.nonEmpty === 0 || numericRatio(s) < 0.7) continue;

      if (stripWords(h, LOCATION_RP_WORDS) !== h) continue;
      if (!perLocationQty.has(c) && isNotALocation(h)) continue;

      const label = locationLabel(h);
      if (!label) continue;
      const category = matchUsageCategory(label);
      if (category) {
        categoryColumns.push({ column: c, category });
        used.add(c);
        continue;
      }
      locationColumns.push({
        column: c,
        location: cleanLocationName(locationLabel(raw.replace(/\s+/g, " ")) || raw),
        kind: "onHand",
      });
      used.add(c);
    }

    for (const [column, targetColumn] of perLocationRp) {
      const target = locationColumns.find((l) => l.kind === "onHand" && l.column === targetColumn);
      if (target) locationColumns.push({ column, location: target.location, kind: "reorderPoint" });
    }
  } else {
    // No header row: first numeric column is the quantity.
    for (let c = 0; c < cols; c++) {
      if (!used.has(c) && stats[c].nonEmpty > 0 && numericRatio(stats[c]) >= 0.7) {
        fields.quantity = c;
        used.add(c);
        break;
      }
    }
  }

  // A "Total" column next to per-location columns is just their sum.
  if (
    fields.quantity !== undefined &&
    headerRow >= 0 &&
    locationColumns.length + categoryColumns.length > 0 &&
    headers[fields.quantity].includes("total")
  ) {
    delete fields.quantity;
  }

  return { headerRow, fields, locationColumns, categoryColumns };
}

// ---------- Row parsing ----------

const LOCATION_WORDS =
  /\b(shelf|shelves|drawer|drawers|cabinet|cabinent|cabinets|register|counter|closet|storage|storeroom|stockroom|back ?room|room|floor|display|station|bin|rack|wall|desk|tower|cart|trolley|cupboard|fridge|basket|window|top|bottom|under|upstairs|downstairs|office|vanity|dispensary|color bar|colour bar|front|back)\b/i;

function isAllCaps(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z]/g, "");
  return letters.length >= 3 && letters === letters.toUpperCase();
}

function isDecorated(text: string): boolean {
  return /^[\s\-=_*~#>|]{2,}|[\s\-=_*~#<|:]{2,}$|:\s*$/.test(text) || /^[-=_*~#]{2,}|[-=_*~#]{2,}$/.test(text.trim());
}

const TOTAL_ROW = /^(grand\s*)?(sub\s*-?\s*)?totals?\b/i;

function roundQty(n: number): number {
  return Math.max(0, Math.round(n));
}

export function parseSheet(rows: SheetRows, mapping: ColumnMapping, options: ParseOptions): ParseResult {
  const { fields } = mapping;
  const skipped: ParseIssue[] = [];
  const notes: ParseIssue[] = [];
  const sections: SectionHeading[] = [];
  const notSection = new Set(options.notSectionRows ?? []);
  const overrides = options.categoryOverrides ?? {};
  const defaultLocation = cleanLocationName(options.defaultLocation) || "Storage";

  const products = new Map<string, ParsedProduct>();
  const locationOrder = new Map<string, string>();
  let usedDefaultLocation = false;

  const noteLocation = (name: string) => {
    const key = locationKey(name);
    if (key && !locationOrder.has(key)) locationOrder.set(key, name);
    return locationOrder.get(key) ?? name;
  };

  const headerNameText =
    mapping.headerRow >= 0 && fields.name !== undefined
      ? normalizeText(cell(rows[mapping.headerRow], fields.name))
      : "";

  let sectionLocation: string | null = null;
  let sectionCategory: UsageCategory | null = null;

  const dataColumns = new Set<number>([
    ...Object.values(fields).filter((v): v is number => v !== undefined),
    ...mapping.locationColumns.map((l) => l.column),
    ...mapping.categoryColumns.map((c) => c.column),
  ]);

  for (let r = mapping.headerRow + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const rowNumber = r + 1;
    const filled = row
      .map((value, index) => ({ value: (value ?? "").toString().trim(), index }))
      .filter((c) => !isBlank(c.value));
    if (filled.length === 0) continue;

    const nameCell = cell(row, fields.name);

    // Repeated header row (multi-page exports) or totals.
    if (headerNameText && normalizeText(nameCell) === headerNameText) continue;
    if (TOTAL_ROW.test(nameCell) || (filled.length <= 2 && filled.some((c) => TOTAL_ROW.test(c.value)))) {
      skipped.push({ row: rowNumber, message: `Skipped totals row "${filled[0].value}"` });
      continue;
    }

    // ----- Section headings -----
    const otherData = filled.filter((c) => c.index !== fields.name && dataColumns.has(c.index));
    if (filled.length === 1 && !notSection.has(rowNumber) && !isStrictNumber(filled[0].value)) {
      const text = filled[0].value;
      const nextRow = rows[r + 1] ?? [];
      const nextIsRule = nextRow.some((c) => (c ?? "").trim() && DECORATION.test((c ?? "").trim())) &&
        nextRow.every((c) => !(c ?? "").trim() || DECORATION.test((c ?? "").trim()));
      const wholeCategory = matchUsageCategory(cleanLocationName(text));
      const split = splitCategoryFromName(cleanLocationName(text));
      const looksLikeSection =
        filled[0].index !== fields.name ||
        isDecorated(text) ||
        isAllCaps(text) ||
        nextIsRule ||
        Boolean(wholeCategory) ||
        (!split.category && LOCATION_WORDS.test(text));

      if (looksLikeSection) {
        const heading: SectionHeading = { row: rowNumber, text };
        if (wholeCategory) {
          sectionCategory = wholeCategory;
          heading.category = wholeCategory;
        } else if (split.category) {
          sectionCategory = split.category;
          sectionLocation = noteLocation(cleanLocationName(split.name));
          heading.category = split.category;
          heading.location = sectionLocation;
        } else {
          sectionLocation = noteLocation(cleanLocationName(text));
          heading.location = sectionLocation;
        }
        sections.push(heading);
        continue;
      }
    }

    if (!nameCell) {
      if (otherData.length > 0) skipped.push({ row: rowNumber, message: "No product name" });
      continue;
    }

    const split = splitCategoryFromName(nameCell);
    if (!split.name) {
      skipped.push({ row: rowNumber, message: `"${nameCell}" has no product name besides the category` });
      continue;
    }

    const rawCategoryCell = cell(row, fields.category);
    const columnCategory =
      matchUsageCategory(rawCategoryCell) ?? splitCategoryFromName(rawCategoryCell).category;

    const rowLocationCell = cell(row, fields.location);
    const rowLocation = rowLocationCell
      ? noteLocation(cleanLocationName(rowLocationCell))
      : sectionLocation;

    // Stock for this row, per category variant. Normally a single variant;
    // a sheet with "Backbar" and "Retail" quantity columns yields two.
    const variants: { category: UsageCategory | null; source: CategorySource | null; stocks: ParsedStock[] }[] = [];

    const baseCategory: UsageCategory | null = split.category ?? columnCategory ?? sectionCategory ?? null;
    const baseSource: CategorySource | null = split.category
      ? "name"
      : columnCategory
        ? "column"
        : sectionCategory
          ? "section"
          : null;

    const readQty = (column: number, label: string): number | undefined => {
      const raw = cell(row, column);
      if (isBlank(raw)) return undefined;
      const n = parseLooseNumber(raw);
      if (n === undefined) {
        notes.push({ row: rowNumber, message: `"${raw}" in ${label} isn't a number — left blank` });
        return undefined;
      }
      if (n < 0) {
        notes.push({ row: rowNumber, message: `Negative count (${raw}) in ${label} imported as 0` });
      }
      return roundQty(n);
    };

    const stocks: ParsedStock[] = [];
    const stockAt = (location: string) => {
      const name = noteLocation(location);
      let s = stocks.find((x) => locationKey(x.location) === locationKey(name));
      if (!s) {
        s = { location: name };
        stocks.push(s);
      }
      return s;
    };

    for (const lc of mapping.locationColumns) {
      const qty = readQty(lc.column, lc.location);
      if (qty === undefined) continue;
      const s = stockAt(lc.location);
      if (lc.kind === "onHand") s.onHand = qty;
      else s.reorderPoint = qty;
    }

    const fallbackLocation = () => {
      if (rowLocation) return rowLocation;
      usedDefaultLocation = true;
      return defaultLocation;
    };

    const qty = fields.quantity !== undefined ? readQty(fields.quantity, "quantity") : undefined;
    const rp = fields.reorderPoint !== undefined ? readQty(fields.reorderPoint, "reorder point") : undefined;
    if (qty !== undefined || rp !== undefined) {
      const s = stockAt(fallbackLocation());
      if (qty !== undefined) s.onHand = (s.onHand ?? 0) + qty;
      if (rp !== undefined) s.reorderPoint = rp;
    }

    for (const cc of mapping.categoryColumns) {
      const q = readQty(cc.column, cc.category);
      if (q === undefined) continue;
      variants.push({
        category: cc.category,
        source: "column",
        stocks: [{ location: noteLocation(fallbackLocation()), onHand: q, reorderPoint: rp }],
      });
    }

    if (variants.length === 0 || stocks.length > 0) {
      if (stocks.length === 0) stocks.push({ location: noteLocation(fallbackLocation()) });
      variants.unshift({ category: baseCategory, source: baseSource, stocks });
    }

    const nameKey = productNameKey(split.name);
    const casePack = parseLooseNumber(cell(row, fields.casePackSize));
    const unitCost = parseLooseNumber(cell(row, fields.unitCost));
    const codeCell = cell(row, fields.code).toUpperCase();

    for (const variant of variants) {
      let category = variant.category;
      let source = variant.source;
      if (!category && overrides[nameKey]) {
        category = overrides[nameKey];
        source = "manual";
      }
      const key = `${nameKey}|${category ?? ""}`;
      let product = products.get(key);
      if (!product) {
        product = {
          key,
          nameKey,
          name: split.name,
          category,
          categorySource: source,
          stocks: [],
          rows: [],
        };
        products.set(key, product);
      }
      product.rows.push(rowNumber);
      product.brand ??= cell(row, fields.brand) || undefined;
      product.vendor ??= cell(row, fields.vendor) || undefined;
      product.unit ??= cell(row, fields.unit) || undefined;
      product.sku ??= cell(row, fields.sku) || undefined;
      if (codeCell && /^P-?\d+$/.test(codeCell)) product.code ??= codeCell.replace(/^P-?/, "P-");
      if (product.casePackSize === undefined && casePack && casePack > 0) product.casePackSize = Math.round(casePack);
      if (product.unitCost === undefined && unitCost !== undefined && unitCost >= 0) product.unitCost = unitCost;

      for (const stock of variant.stocks) {
        const existing = product.stocks.find((s) => locationKey(s.location) === locationKey(stock.location));
        if (!existing) {
          product.stocks.push({ ...stock });
          continue;
        }
        if (stock.onHand !== undefined) {
          if (existing.onHand !== undefined) {
            notes.push({
              row: rowNumber,
              message: `"${split.name}" is listed twice in ${existing.location} (also row ${product.rows[0]}) — counts added together (${existing.onHand} + ${stock.onHand})`,
            });
          }
          existing.onHand = (existing.onHand ?? 0) + stock.onHand;
        }
        if (stock.reorderPoint !== undefined) existing.reorderPoint = stock.reorderPoint;
      }
    }
  }

  return {
    products: Array.from(products.values()),
    locations: Array.from(locationOrder.values()),
    sections,
    skipped,
    notes,
    usedDefaultLocation,
  };
}

/** Combines several sheets (e.g. one tab per location) into one result. */
export function mergeParseResults(results: { sheet: string; result: ParseResult }[]): ParseResult {
  const products = new Map<string, ParsedProduct>();
  const locations = new Map<string, string>();
  const merged: ParseResult = {
    products: [],
    locations: [],
    sections: [],
    skipped: [],
    notes: [],
    usedDefaultLocation: false,
  };
  const tag = (sheet: string, issues: ParseIssue[]) =>
    issues.map((i) => ({ ...i, message: `${sheet}: ${i.message}` }));

  for (const { sheet, result } of results) {
    for (const name of result.locations) {
      const key = locationKey(name);
      if (!locations.has(key)) locations.set(key, name);
    }
    merged.sections.push(...result.sections.map((s) => ({ ...s, text: `${sheet}: ${s.text}` })));
    merged.skipped.push(...tag(sheet, result.skipped));
    merged.notes.push(...tag(sheet, result.notes));
    merged.usedDefaultLocation ||= result.usedDefaultLocation;
    for (const product of result.products) {
      const existing = products.get(product.key);
      if (!existing) {
        products.set(product.key, { ...product, stocks: product.stocks.map((s) => ({ ...s })) });
        continue;
      }
      existing.rows.push(...product.rows);
      existing.brand ??= product.brand;
      existing.vendor ??= product.vendor;
      existing.unit ??= product.unit;
      existing.sku ??= product.sku;
      existing.code ??= product.code;
      existing.casePackSize ??= product.casePackSize;
      existing.unitCost ??= product.unitCost;
      for (const stock of product.stocks) {
        const same = existing.stocks.find((s) => locationKey(s.location) === locationKey(stock.location));
        if (!same) existing.stocks.push({ ...stock });
        else {
          if (stock.onHand !== undefined) same.onHand = (same.onHand ?? 0) + stock.onHand;
          if (stock.reorderPoint !== undefined) same.reorderPoint = stock.reorderPoint;
        }
      }
    }
  }
  merged.products = Array.from(products.values());
  merged.locations = Array.from(locations.values());
  return merged;
}

export { BACKBAR, RETAIL };
