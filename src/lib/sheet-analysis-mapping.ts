// Turns Claude's reading of a sheet into the importer's ColumnMapping plus
// row hints. Pure — runs in the browser. Anything out of range or
// contradictory is dropped, so a bad reading can't break an import.

import type { SheetAnalysis } from "@/lib/sheet-analyst";
import type { ColumnMapping, FieldKey, IgnoredColumn, SheetRows } from "@/lib/import-parser";
import { BACKBAR, RETAIL, type UsageCategory } from "@/lib/categories";
import { cleanLocationName, findLocationMatch } from "@/lib/locations";

const FIELD_FOR_ROLE: Partial<Record<SheetAnalysis["columns"][number]["role"], FieldKey>> = {
  product_name: "name",
  backbar_or_retail: "category",
  location_name: "location",
  on_hand: "quantity",
  reorder_point: "reorderPoint",
  brand: "brand",
  vendor: "vendor",
  unit: "unit",
  case_pack: "casePackSize",
  unit_cost: "unitCost",
  vendor_sku: "sku",
  invii_code: "code",
};

export type RowHints = {
  headingRows: Record<number, { location: string | null; category: UsageCategory | null }>;
  skipRows: Record<number, string>;
};

export type ColumnExplanation = { column: number; role: string; explanation: string };

export function mappingFromAnalysis(
  analysis: SheetAnalysis,
  rows: SheetRows,
  knownLocations: string[],
): { mapping: ColumnMapping; hints: RowHints; explanations: ColumnExplanation[] } | null {
  const cols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const inRange = (c: number) => Number.isInteger(c) && c >= 0 && c < cols;
  const headerRow =
    Number.isInteger(analysis.headerRow) && analysis.headerRow >= -1 && analysis.headerRow < rows.length
      ? analysis.headerRow
      : -1;

  const known = knownLocations.map((name) => ({ name }));
  const placeName = (raw: string | null) => {
    const cleaned = cleanLocationName(raw ?? "");
    if (!cleaned) return null;
    return findLocationMatch(cleaned, known)?.name ?? cleaned;
  };

  const fields: ColumnMapping["fields"] = {};
  const locationColumns: ColumnMapping["locationColumns"] = [];
  const categoryColumns: ColumnMapping["categoryColumns"] = [];
  const ignoredColumns: IgnoredColumn[] = [];
  const start: number[] = [];
  const add: number[] = [];
  const subtract: number[] = [];
  const seen = new Set<number>();

  for (const col of analysis.columns) {
    if (!inRange(col.column) || seen.has(col.column)) continue;
    seen.add(col.column);
    const field = FIELD_FOR_ROLE[col.role];
    if (field) {
      if (fields[field] === undefined) fields[field] = col.column;
      else ignoredColumns.push({ column: col.column, reason: "noise", note: col.explanation });
      continue;
    }
    switch (col.role) {
      case "location_on_hand":
      case "location_reorder_point": {
        const location = placeName(col.location);
        if (!location) {
          ignoredColumns.push({ column: col.column, reason: "not-a-location", note: col.explanation });
          break;
        }
        locationColumns.push({
          column: col.column,
          location,
          kind: col.role === "location_on_hand" ? "onHand" : "reorderPoint",
        });
        break;
      }
      case "backbar_on_hand":
        categoryColumns.push({ column: col.column, category: BACKBAR });
        break;
      case "retail_on_hand":
        categoryColumns.push({ column: col.column, category: RETAIL });
        break;
      case "starting_count":
        start.push(col.column);
        break;
      case "received":
        add.push(col.column);
        break;
      case "used_or_lost":
        subtract.push(col.column);
        break;
      default:
        ignoredColumns.push({ column: col.column, reason: "noise", note: col.explanation });
    }
  }

  if (fields.name === undefined) return null; // no product column — not a usable reading

  const explain = (c: number) => analysis.columns.find((x) => x.column === c)?.explanation ?? "";
  let movements: ColumnMapping["movements"];
  if (fields.quantity === undefined && locationColumns.length === 0 && categoryColumns.length === 0 && start.length) {
    movements = { start: start[0], add, subtract };
  } else {
    for (const c of [...start, ...add, ...subtract]) {
      ignoredColumns.push({ column: c, reason: "movement", note: explain(c) });
    }
  }

  const hints: RowHints = { headingRows: {}, skipRows: {} };
  for (const h of analysis.headingRows) {
    if (!Number.isInteger(h.row) || h.row <= headerRow || h.row >= rows.length) continue;
    const category = h.category === "Backbar" ? BACKBAR : h.category === "Retail" ? RETAIL : null;
    const location = placeName(h.location);
    if (location || category) hints.headingRows[h.row] = { location, category };
  }
  for (const s of analysis.skipRows) {
    if (!Number.isInteger(s.row) || s.row <= headerRow || s.row >= rows.length) continue;
    if (!hints.headingRows[s.row]) hints.skipRows[s.row] = s.reason;
  }

  return {
    mapping: {
      headerRow,
      fields,
      locationColumns,
      categoryColumns,
      ...(movements ? { movements } : {}),
      ...(ignoredColumns.length ? { ignoredColumns: ignoredColumns.sort((a, b) => a.column - b.column) } : {}),
    },
    hints,
    explanations: analysis.columns
      .filter((c) => inRange(c.column))
      .map((c) => ({ column: c.column, role: c.role, explanation: c.explanation })),
  };
}
