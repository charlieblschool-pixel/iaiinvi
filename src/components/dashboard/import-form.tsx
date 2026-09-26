"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button, LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { BACKBAR, RETAIL, USAGE_CATEGORIES, type UsageCategory } from "@/lib/categories";
import { cleanLocationName, locationKey } from "@/lib/locations";
import {
  FIELD_KEYS,
  FIELD_LABELS,
  columnName,
  guessMapping,
  mergeParseResults,
  parseSheet,
  unstackSideBySide,
  type ColumnMapping,
  type FieldKey,
  type ParseResult,
  type ParsedProduct,
  type SheetRows,
} from "@/lib/import-parser";
import {
  mappingFromAnalysis,
  type ColumnExplanation,
  type RowHints,
} from "@/lib/sheet-analysis-mapping";
import type { SheetAnalysis } from "@/lib/sheet-analyst";
import {
  planImport,
  type ExistingLocation,
  type ExistingProduct,
  type ImportProduct,
} from "@/lib/import-plan";

type Sheet = { name: string; rows: SheetRows; rowNumbers?: number[]; sideBySide?: boolean };
type Outcome = {
  created: number;
  updated: number;
  locationsCreated: string[];
  firstNewCode: string | null;
  lastNewCode: string | null;
};

const ALL_SHEETS = -1;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const PAGE_SIZE = 150;

const EXAMPLE_CSV = [
  "Product,Brand,Top of Retail Shelf,Retail Drawer,Floor,Cabinet,Register",
  "Shampoo - retail,Redken,4,2,,,1",
  "Conditioner - retail,Redken,3,,,,",
  "Blowout Creme - backbar,Oribe,,,3,5,",
  "Color Developer - backbar,Redken,,,6,12,",
].join("\n");

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toLocaleDateString();
  return String(value).replace(/^﻿/, "").trim();
}

function parseCsv(file: File, encoding?: string): Promise<SheetRows> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: false,
      encoding,
      complete: (res) => resolve(res.data.map((row) => row.map(cellToString))),
      error: reject,
    });
  });
}

async function readWorkbook(file: File): Promise<Sheet[]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xlsm")) {
    const { default: readXlsxFile } = await import("read-excel-file/universal");
    const sheets = await readXlsxFile(file);
    return sheets.map((s) => ({
      name: s.sheet,
      rows: s.data.map((row) => row.map(cellToString)),
    }));
  }
  if (lower.endsWith(".xls") || lower.endsWith(".numbers") || lower.endsWith(".ods")) {
    throw new Error(
      "That file type can't be read directly. In Excel, Numbers or Google Sheets choose File → Save As (or Export) → .xlsx or CSV, then upload that.",
    );
  }
  let rows = await parseCsv(file);
  // Excel on Windows saves CSVs as Windows-1252 — re-read if accents came out garbled.
  if (rows.some((r) => r.some((c) => c.includes("�")))) {
    rows = await parseCsv(file, "windows-1252");
  }
  return [{ name: file.name.replace(/\.[^.]+$/, ""), rows }];
}

/** "Sheet1", "Tab 2" etc. say nothing about where stock lives. */
function isMeaningfulTabName(name: string) {
  return !/^(sheet|tab|page|table)\s*\d*$/i.test(name.trim());
}

function hasData(rows: SheetRows) {
  return rows.filter((r) => r.some((c) => c.trim())).length >= 2;
}

export function ImportForm({
  locations,
  products: existingProducts,
}: {
  locations: ExistingLocation[];
  products: ExistingProduct[];
}) {
  const router = useRouter();
  const [fileName, setFileName] = useState<string | null>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [defaultLocation, setDefaultLocation] = useState(locations[0]?.name ?? "Storage");
  const [overrides, setOverrides] = useState<Record<string, UsageCategory>>({});
  const [notSectionRows, setNotSectionRows] = useState<Record<number, number[]>>({});
  const [locationRenames, setLocationRenames] = useState<Record<string, string>>({});
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [dragging, setDragging] = useState(false);
  const [defaultLocationTouched, setDefaultLocationTouched] = useState(false);
  // Claude's reading of each sheet, and whether it's the one in use.
  const [ai, setAi] = useState<Record<number, AiState>>({});
  const [ruleMappings, setRuleMappings] = useState<ColumnMapping[]>([]);
  // Tabs whose columns the user adjusted by hand — Claude won't overwrite those.
  const touched = useRef<Record<number, boolean>>({});
  const loadId = useRef(0);
  const knownLocationNames = locations.map((l) => l.name);

  function reset() {
    setFileName(null);
    setSheets([]);
    setMappings([]);
    setOverrides({});
    setNotSectionRows({});
    setLocationRenames({});
    setDefaultLocationTouched(false);
    setAi({});
    setRuleMappings([]);
    touched.current = {};
    loadId.current += 1;
    setError(null);
    setOutcome(null);
  }

  /** Ask Claude to read each sheet; its reading replaces the rule-based guess. */
  async function askClaude(workbook: Sheet[], id: number) {
    setAi(Object.fromEntries(workbook.map((_, i) => [i, { status: "reading" } as AiState])));
    await Promise.all(
      workbook.slice(0, 8).map(async (sheet, i) => {
        let next: AiState = { status: "failed" };
        try {
          const res = await fetch("/api/import/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sheetName: sheet.name,
              rows: sheet.rows.slice(0, 250).map((r) => r.slice(0, 40).map((c) => c.slice(0, 500))),
              knownLocations: knownLocationNames,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.status === 503 && data.available === false) {
            next = { status: "off" };
          } else if (res.ok && data.analysis) {
            const reading = mappingFromAnalysis(data.analysis as SheetAnalysis, sheet.rows, knownLocationNames);
            next = reading
              ? {
                  status: "done",
                  summary: (data.analysis as SheetAnalysis).summary,
                  mapping: reading.mapping,
                  hints: reading.hints,
                  explanations: reading.explanations,
                  applied: true,
                }
              : { status: "failed", message: "Claude couldn't find a product column — using the standard reader." };
          } else {
            next = { status: "failed", message: data.error };
          }
        } catch {
          next = { status: "failed" };
        }
        if (loadId.current !== id) return; // a different file was loaded meanwhile
        setAi((prev) => (prev[i]?.status === "skipped" ? prev : { ...prev, [i]: next }));
        if (next.status === "done") {
          const reading = next;
          if (touched.current[i]) {
            setAi((prev) => ({ ...prev, [i]: { ...reading, applied: false } }));
          } else {
            setMappings((prev) => prev.map((m, j) => (j === i ? reading.mapping : m)));
          }
        }
      }),
    );
    workbook.slice(8).forEach((_, k) =>
      setAi((prev) => ({ ...prev, [k + 8]: { status: "failed", message: "Only the first 8 tabs are read by Claude." } })),
    );
  }

  function useStandardReader(i: number) {
    setAi((prev) => ({ ...prev, [i]: { ...prev[i], applied: false } as AiState }));
    setMappings((prev) => prev.map((m, j) => (j === i ? ruleMappings[i] : m)));
  }

  function useClaudeReading(i: number) {
    const state = ai[i];
    if (state?.status !== "done") return;
    setAi((prev) => ({ ...prev, [i]: { ...state, applied: true } }));
    setMappings((prev) => prev.map((m, j) => (j === i ? state.mapping : m)));
  }

  async function handleFile(file: File) {
    reset();
    if (file.size > MAX_FILE_BYTES) {
      setError("That file is over 15 MB. Remove extra tabs or columns and try again.");
      return;
    }
    setReading(true);
    try {
      const workbook = (await readWorkbook(file))
        .filter((s) => hasData(s.rows))
        .map((s): Sheet => {
          const unstacked = unstackSideBySide(s.rows);
          return unstacked ? { ...s, ...unstacked, sideBySide: true } : s;
        });
      if (workbook.length === 0) {
        setError("We couldn't find any rows in that file. Make sure it has a product list with at least one product.");
        return;
      }
      setFileName(file.name);
      setSheets(workbook);
      const guessed = workbook.map((s) => guessMapping(s.rows, knownLocationNames));
      setMappings(guessed);
      setRuleMappings(guessed);
      void askClaude(workbook, loadId.current);
      // Several tabs named like places ("Floor", "Cabinet") → one tab per location.
      setSheetIndex(
        workbook.length > 1 && workbook.every((s) => isMeaningfulTabName(s.name)) ? ALL_SHEETS : 0,
      );
    } catch (err) {
      setError(
        err instanceof Error && err.message.startsWith("That file")
          ? err.message
          : "We couldn't read that file. Upload a .xlsx or .csv spreadsheet.",
      );
    } finally {
      setReading(false);
    }
  }

  // ----- Parse → rename locations → plan (re-runs instantly on every change) -----
  const parsed: ParseResult | null = useMemo(() => {
    if (sheets.length === 0) return null;
    const run = (i: number, fallback: string) =>
      parseSheet(sheets[i].rows, mappings[i], {
        defaultLocation: fallback,
        categoryOverrides: overrides,
        notSectionRows: notSectionRows[i],
        rowNumbers: sheets[i].rowNumbers,
        ...(aiHints(ai[i]) ?? {}),
      });
    if (sheetIndex === ALL_SHEETS) {
      return mergeParseResults(
        sheets.map((s, i) => ({ sheet: s.name, result: run(i, cleanLocationName(s.name)) })),
      );
    }
    const tab = sheets[sheetIndex];
    const tabLocation =
      sheets.length > 1 && isMeaningfulTabName(tab.name) && !defaultLocationTouched
        ? cleanLocationName(tab.name)
        : defaultLocation;
    return run(sheetIndex, tabLocation);
  }, [sheets, mappings, sheetIndex, defaultLocation, defaultLocationTouched, overrides, notSectionRows, ai]);

  const products: ImportProduct[] = useMemo(() => {
    if (!parsed) return [];
    const rename = (label: string) => locationRenames[locationKey(label)]?.trim() || label;
    return parsed.products.map((p) => ({
      name: p.name,
      category: p.category,
      brand: p.brand,
      vendor: p.vendor,
      unit: p.unit,
      casePackSize: p.casePackSize,
      unitCost: p.unitCost,
      sku: p.sku,
      code: p.code,
      stocks: p.stocks.map((s) => ({ ...s, location: rename(s.location) })),
    }));
  }, [parsed, locationRenames]);

  const plan = useMemo(
    () => planImport(products, { locations, products: existingProducts }),
    [products, locations, existingProducts],
  );

  async function handleImport() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Import failed — nothing was changed. Please try again.");
        return;
      }
      setOutcome(data as Outcome);
      router.refresh();
    } catch {
      setError("Couldn't reach invii.ai — check your connection. Nothing was changed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (outcome) return <ImportDone outcome={outcome} onAgain={reset} />;

  if (!parsed) {
    return (
      <UploadCard
        reading={reading}
        error={error}
        dragging={dragging}
        setDragging={setDragging}
        onFile={handleFile}
      />
    );
  }

  const needsCategory = parsed.products.filter((p) => !p.category);
  const newCount = plan.products.filter((p) => p.action === "create").length;
  const updateCount = plan.products.length - newCount;
  const backbarCount = parsed.products.filter((p) => p.category === BACKBAR).length;
  const retailCount = parsed.products.filter((p) => p.category === RETAIL).length;
  const activeTabs = sheetIndex === ALL_SHEETS ? sheets.map((_, i) => i) : [sheetIndex];
  const claudeReading = activeTabs.some((i) => ai[i]?.status === "reading");
  const canImport =
    parsed.products.length > 0 && needsCategory.length === 0 && !submitting && !claudeReading;

  function setCategory(nameKeys: string[], category: UsageCategory) {
    setOverrides((prev) => {
      const next = { ...prev };
      for (const k of nameKeys) next[k] = category;
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-5 pb-28">
      {/* File */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate font-medium">{fileName}</p>
          {sheets.some((s) => s.sideBySide) && (
            <p className="mt-1 text-xs text-foreground-muted">
              Side-by-side lists were combined into one — row numbers still match your sheet.
            </p>
          )}
          {sheets.length > 1 ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-foreground-muted">Tab:</span>
              <Select
                value={sheetIndex}
                onChange={(e) => setSheetIndex(Number(e.target.value))}
                className="h-9 w-auto"
              >
                {sheets.map((s, i) => (
                  <option key={s.name} value={i}>
                    {s.name}
                  </option>
                ))}
                <option value={ALL_SHEETS}>All {sheets.length} tabs — each tab is a location</option>
              </Select>
            </div>
          ) : null}
        </div>
        <Button variant="secondary" size="sm" onClick={reset}>
          Choose a different file
        </Button>
      </Card>

      <ClaudeCard
        tabs={activeTabs.map((i) => ({ index: i, name: sheets[i].name, state: ai[i] }))}
        rows={sheets}
        mappings={mappings}
        onUseStandard={useStandardReader}
        onUseClaude={useClaudeReading}
        onSkip={() =>
          setAi((prev) => {
            const next = { ...prev };
            for (const i of activeTabs) if (next[i]?.status === "reading") next[i] = { status: "skipped" };
            return next;
          })
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Products" value={parsed.products.length} hint={`${newCount} new · ${updateCount} update`} />
        <Stat label="Backbar" value={backbarCount} />
        <Stat label="Retail" value={retailCount} />
        <Stat
          label="Locations"
          value={plan.locations.length}
          hint={`${plan.locations.filter((l) => l.isNew).length} new`}
        />
      </div>

      {parsed.products.length === 0 && (
        <Card className="border-status-warn/40 p-5 text-sm">
          <p className="font-medium">No products found with the current column setup.</p>
          <p className="mt-1 text-foreground-muted">
            Open &ldquo;Column matching&rdquo; below and pick the column that holds product names.
          </p>
        </Card>
      )}

      {needsCategory.length > 0 && (
        <Card className="border-status-warn/50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium">
                {needsCategory.length === 1
                  ? "1 product doesn’t say Backbar or Retail"
                  : `${needsCategory.length} products don’t say Backbar or Retail`}
              </p>
              <p className="mt-1 text-sm text-foreground-muted">
                Add &ldquo;- backbar&rdquo; or &ldquo;- retail&rdquo; to the name in your sheet, or pick
                one here. They&rsquo;re listed first in the table below.
              </p>
            </div>
            <div className="flex gap-2">
              {USAGE_CATEGORIES.map((c) => (
                <Button
                  key={c}
                  variant="secondary"
                  size="sm"
                  onClick={() => setCategory(needsCategory.map((p) => p.nameKey), c)}
                >
                  Mark all {c}
                </Button>
              ))}
            </div>
          </div>
        </Card>
      )}

      <LocationsCard
        plan={plan}
        parsed={parsed}
        products={products}
        renames={locationRenames}
        setRenames={setLocationRenames}
        defaultLocation={
          sheets.length > 1 && sheetIndex !== ALL_SHEETS && !defaultLocationTouched && isMeaningfulTabName(sheets[sheetIndex].name)
            ? cleanLocationName(sheets[sheetIndex].name)
            : defaultLocation
        }
        setDefaultLocation={(v) => {
          setDefaultLocationTouched(true);
          setDefaultLocation(v);
        }}
        showDefault={parsed.usedDefaultLocation && sheetIndex !== ALL_SHEETS}
        existingLocations={locations}
      />

      {parsed.sections.length > 0 && (
        <SectionsCard
          parsed={parsed}
          allSheets={sheetIndex === ALL_SHEETS}
          onNotSection={(row) =>
            setNotSectionRows((prev) => ({
              ...prev,
              [sheetIndex]: [...(prev[sheetIndex] ?? []), row],
            }))
          }
        />
      )}

      <ProductsTable parsed={parsed} plan={plan} products={products} onCategory={setCategory} />

      {sheetIndex !== ALL_SHEETS && (
        <MappingCard
          knownLocationNames={knownLocationNames}
          rows={sheets[sheetIndex].rows}
          mapping={mappings[sheetIndex]}
          onChange={(m) => {
            touched.current[sheetIndex] = true;
            setMappings((prev) => prev.map((x, i) => (i === sheetIndex ? m : x)));
          }}
        />
      )}

      {(parsed.skipped.length > 0 || parsed.notes.length > 0) && <IssuesCard parsed={parsed} />}

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border-hairline bg-background/95 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p className="text-sm text-foreground-muted">
            {error ? (
              <span className="text-status-bad">{error}</span>
            ) : claudeReading ? (
              <span className="text-brand-light">Claude is reading your sheet — one moment…</span>
            ) : needsCategory.length > 0 ? (
              <span className="text-status-warn">
                Choose Backbar or Retail for {needsCategory.length} product
                {needsCategory.length === 1 ? "" : "s"} to continue.
              </span>
            ) : (
              <>
                {newCount} new product{newCount === 1 ? "" : "s"} get a code · {updateCount} existing
                updated · nothing is saved until you import
              </>
            )}
          </p>
          <Button onClick={handleImport} disabled={!canImport}>
            {submitting
              ? "Importing…"
              : claudeReading
                ? "Reading…"
              : `Import ${parsed.products.length} product${parsed.products.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------- Pieces ----------

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value.toLocaleString()}</p>
      {hint && <p className="text-xs text-foreground-muted">{hint}</p>}
    </Card>
  );
}

function UploadCard({
  reading,
  error,
  dragging,
  setDragging,
  onFile,
}: {
  reading: boolean;
  error: string | null;
  dragging: boolean;
  setDragging: (v: boolean) => void;
  onFile: (f: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function downloadExample() {
    const url = URL.createObjectURL(new Blob([EXAMPLE_CSV], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "invii-import-example.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-5">
      <Card
        className={cn(
          "border-2 border-dashed p-10 text-center transition-colors",
          dragging ? "border-brand-light bg-brand/5" : "border-border-hairline",
        )}
        onDragOver={(e: React.DragEvent) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e: React.DragEvent) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
      >
        <p className="font-medium">Drop your spreadsheet here</p>
        <p className="mt-1 text-sm text-foreground-muted">Excel (.xlsx) or CSV from Excel, Google Sheets or Numbers</p>
        <Button className="mt-5" onClick={() => inputRef.current?.click()} disabled={reading}>
          {reading ? "Reading…" : "Choose file"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xlsm,.csv,.tsv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onFile(file);
          }}
        />
        {error && <p className="mt-4 text-sm text-status-bad">{error}</p>}
      </Card>

      <Card className="p-6 text-sm">
        <h2 className="font-semibold">How we read your sheet</h2>
        <ul className="mt-3 flex flex-col gap-2.5 text-foreground-muted">
          <li>
            <span className="text-foreground">Backbar or Retail comes from the product name</span> —
            &ldquo;Blowout Creme - backbar&rdquo;, &ldquo;Shampoo (retail)&rdquo;. A Backbar/Retail column
            works too.
          </li>
          <li>
            <span className="text-foreground">Locations can be columns</span> (Top of Retail Shelf ·
            Retail Drawer · Floor · Cabinet · Register), a Location column, heading rows like
            &ldquo;RETAIL DRAWER -----&rdquo; above their products, or one tab per location.
          </li>
          <li>
            <span className="text-foreground">Every new product gets a permanent code</span> (P-0001).
            Re-importing a recount updates counts — it never creates duplicates.
          </li>
          <li>You&rsquo;ll see a full preview before anything is saved.</li>
        </ul>
        <button onClick={downloadExample} className="mt-4 text-brand-light hover:underline">
          Download an example sheet
        </button>
      </Card>
    </div>
  );
}

function LocationsCard({
  plan,
  parsed,
  products,
  renames,
  setRenames,
  defaultLocation,
  setDefaultLocation,
  showDefault,
  existingLocations,
}: {
  plan: ReturnType<typeof planImport>;
  parsed: ParseResult;
  products: ImportProduct[];
  renames: Record<string, string>;
  setRenames: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  defaultLocation: string;
  setDefaultLocation: (v: string) => void;
  showDefault: boolean;
  existingLocations: ExistingLocation[];
}) {
  const [editing, setEditing] = useState<string | null>(null);

  const counts = new Map<string, number>();
  for (const p of products) {
    const seen = new Set<string>();
    for (const s of p.stocks) {
      const resolved = plan.locationFor.get(locationKey(cleanLocationName(s.location)));
      if (resolved && !seen.has(resolved.name)) {
        seen.add(resolved.name);
        counts.set(resolved.name, (counts.get(resolved.name) ?? 0) + 1);
      }
    }
  }

  // One chip per resolved location, keyed by the label as written in the
  // sheet so a rename sticks even as the plan re-runs.
  const chips: { key: string; plan: (typeof plan.locations)[number] }[] = [];
  const shown = new Set<string>();
  for (const label of parsed.locations) {
    const key = locationKey(label);
    const renamed = renames[key]?.trim() || label;
    const resolved = plan.locationFor.get(locationKey(cleanLocationName(renamed)));
    if (!resolved || shown.has(resolved.name)) continue;
    shown.add(resolved.name);
    chips.push({ key, plan: resolved });
  }

  return (
    <Card className="p-5">
      <h2 className="font-semibold">Locations</h2>
      <p className="mt-1 text-sm text-foreground-muted">
        In the order they appear in your sheet. Click a new one to rename it — type an existing
        location&rsquo;s name to merge into it.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {chips.map(({ key, plan: l }) => {
          if (editing === key) {
            return (
              <form
                key={l.name}
                className="flex items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  setEditing(null);
                }}
              >
                <Input
                  autoFocus
                  list="existing-locations"
                  defaultValue={renames[key] ?? l.name}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    setRenames((prev) => ({ ...prev, [key]: value }));
                    setEditing(null);
                  }}
                  className="h-9 w-48"
                />
              </form>
            );
          }
          return (
            <button
              key={l.name}
              type="button"
              onClick={() => l.isNew && setEditing(key)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
                l.isNew
                  ? "border-brand/40 bg-brand/5 hover:border-brand-light"
                  : "cursor-default border-border-hairline bg-surface-raised",
              )}
              title={l.isNew ? "New location — click to rename" : "Already in your workspace"}
            >
              <span>{l.name}</span>
              <span className="text-xs text-foreground-muted">{counts.get(l.name) ?? 0}</span>
              {l.isNew ? (
                <Badge tone="good" className="px-1.5 py-0 text-[10px]">new</Badge>
              ) : l.label !== l.name ? (
                <span className="text-[11px] text-foreground-muted">from &ldquo;{l.label}&rdquo;</span>
              ) : null}
            </button>
          );
        })}
      </div>
      <datalist id="existing-locations">
        {existingLocations.map((l) => (
          <option key={l.id} value={l.name} />
        ))}
      </datalist>

      {showDefault && (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border-hairline pt-4 text-sm">
          <span className="text-foreground-muted">Products with no location in the sheet go to</span>
          <Input
            list="existing-locations"
            value={defaultLocation}
            onChange={(e) => setDefaultLocation(e.target.value)}
            placeholder="e.g. Cabinet"
            className="h-9 w-52"
          />
        </div>
      )}
    </Card>
  );
}

function SectionsCard({
  parsed,
  allSheets,
  onNotSection,
}: {
  parsed: ParseResult;
  allSheets: boolean;
  onNotSection: (row: number) => void;
}) {
  return (
    <details className="group rounded-2xl border border-border-hairline bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
        <div>
          <h2 className="font-semibold">
            {parsed.sections.length} heading row{parsed.sections.length === 1 ? "" : "s"}
          </h2>
          <p className="mt-0.5 text-sm text-foreground-muted">
            Rows like &ldquo;{parsed.sections[0].text}&rdquo; — the products under each one go to that
            location. Open to check them.
          </p>
        </div>
        <span className="text-foreground-muted transition-transform group-open:rotate-180">▾</span>
      </summary>
      <ul className="flex flex-col divide-y divide-border-hairline border-t border-border-hairline px-5 py-2 text-sm">
        {parsed.sections.map((s) => (
          <li key={`${s.text}-${s.row}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>
              <span className="text-foreground-muted">Row {s.row}:</span> &ldquo;{s.text}&rdquo; →{" "}
              {[s.location, s.category].filter(Boolean).join(" · ")}
            </span>
            {!allSheets && (
              <button onClick={() => onNotSection(s.row)} className="text-xs text-brand-light hover:underline">
                It&rsquo;s a product, not a heading
              </button>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

function CategoryToggle({
  value,
  onChange,
}: {
  value: UsageCategory | null;
  onChange: (c: UsageCategory) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-border-hairline p-0.5">
      {USAGE_CATEGORIES.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium transition-all duration-150 active:scale-95",
            value === c ? "bg-brand text-white" : "text-foreground-muted hover:text-foreground",
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

type TableFilter = "all" | "new" | "update" | "needs";

function ProductsTable({
  parsed,
  plan,
  products,
  onCategory,
}: {
  parsed: ParseResult;
  plan: ReturnType<typeof planImport>;
  products: ImportProduct[];
  onCategory: (nameKeys: string[], c: UsageCategory) => void;
}) {
  const [filter, setFilter] = useState<TableFilter>("all");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const rows = parsed.products
    .map((p, i) => ({ parsed: p, product: products[i], plan: plan.products[i] }))
    .filter((r) => {
      if (filter === "new" && r.plan.action !== "create") return false;
      if (filter === "update" && r.plan.action !== "update") return false;
      if (filter === "needs" && r.parsed.category) return false;
      if (query) {
        const q = query.toLowerCase();
        return (
          r.parsed.name.toLowerCase().includes(q) ||
          (r.parsed.brand ?? "").toLowerCase().includes(q) ||
          (r.plan.existingCode ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => Number(Boolean(a.parsed.category)) - Number(Boolean(b.parsed.category)));

  const visible = showAll ? rows : rows.slice(0, PAGE_SIZE);
  const needs = parsed.products.filter((p) => !p.category).length;

  const tabs: { key: TableFilter; label: string }[] = [
    { key: "all", label: `All ${parsed.products.length}` },
    { key: "new", label: `New ${plan.products.filter((p) => p.action === "create").length}` },
    { key: "update", label: `Updates ${plan.products.filter((p) => p.action === "update").length}` },
    ...(needs ? [{ key: "needs" as const, label: `Needs category ${needs}` }] : []),
  ];

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-hairline p-4">
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150 active:scale-95",
                filter === t.key
                  ? "border-brand bg-brand/10 text-brand-light"
                  : "border-border-hairline text-foreground-muted hover:border-white/40 hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products"
          className="h-9 w-full sm:w-56"
        />
      </div>
      <div className="max-h-[560px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="text-left text-xs uppercase tracking-wider text-foreground-muted">
              <th className="px-4 py-2.5 font-medium">Code</th>
              <th className="px-4 py-2.5 font-medium">Product</th>
              <th className="px-4 py-2.5 font-medium">Category</th>
              <th className="px-4 py-2.5 font-medium">Stock by location</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ parsed: p, product, plan: pp }) => (
              <ProductRow
                key={p.key}
                p={p}
                product={product}
                pp={pp}
                onCategory={onCategory}
                locationName={(label) =>
                  plan.locationFor.get(locationKey(cleanLocationName(label)))?.name ?? label
                }
              />
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-foreground-muted">
                  Nothing matches.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!showAll && rows.length > PAGE_SIZE && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full border-t border-border-hairline py-3 text-sm text-brand-light hover:underline"
        >
          Show all {rows.length} products
        </button>
      )}
    </Card>
  );
}

function ProductRow({
  p,
  product,
  pp,
  onCategory,
  locationName,
}: {
  p: ParsedProduct;
  product: ImportProduct;
  pp: ReturnType<typeof planImport>["products"][number];
  onCategory: (nameKeys: string[], c: UsageCategory) => void;
  locationName: (label: string) => string;
}) {
  const categoryEditable = !p.category || p.categorySource === "manual";
  return (
    <tr className={cn("border-t border-border-hairline align-top", !p.category && "bg-status-warn-bg/30")}>
      <td className="whitespace-nowrap px-4 py-2.5">
        {pp.action === "update" ? (
          <span className="font-mono text-xs">{pp.existingCode}</span>
        ) : (
          <Badge tone="good" className="text-[10px]">new</Badge>
        )}
      </td>
      <td className="px-4 py-2.5">
        <p>{p.name}</p>
        <p className="text-xs text-foreground-muted">
          {[
            p.brand,
            pp.action === "update" && pp.rename ? `renamed from “${pp.existingName}”` : null,
            pp.action === "update" && pp.matchedBy === "sku" ? "matched by SKU" : null,
            `row ${p.rows.slice(0, 3).join(", ")}${p.rows.length > 3 ? "…" : ""}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </td>
      <td className="whitespace-nowrap px-4 py-2.5">
        {categoryEditable ? (
          <CategoryToggle value={p.category} onChange={(c) => onCategory([p.nameKey], c)} />
        ) : (
          <span
            className="text-sm"
            title={p.categorySource === "name" ? "From the product name" : p.categorySource === "column" ? "From the category column" : "From a heading row"}
          >
            {p.category}
          </span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex flex-wrap gap-1">
          {product.stocks.map((s) => (
            <span
              key={s.location}
              className="rounded-md border border-border-hairline bg-surface-raised px-2 py-0.5 text-xs"
            >
              {locationName(s.location)}{" "}
              <span className="font-medium tabular-nums">{s.onHand ?? "—"}</span>
              {s.reorderPoint !== undefined && (
                <span className="text-foreground-muted"> · par {s.reorderPoint}</span>
              )}
            </span>
          ))}
        </div>
      </td>
    </tr>
  );
}

function MappingCard({
  knownLocationNames,
  rows,
  mapping,
  onChange,
}: {
  knownLocationNames: string[];
  rows: SheetRows;
  mapping: ColumnMapping;
  onChange: (m: ColumnMapping) => void;
}) {
  const colCount = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const columns = Array.from({ length: colCount }, (_, i) => ({ index: i, label: columnName(rows, mapping, i) }));
  const locationCols = new Set(mapping.locationColumns.map((l) => l.column));
  const categoryCols = new Set(mapping.categoryColumns.map((c) => c.column));
  const unusedForLocations = columns.filter(
    (c) =>
      !Object.values(mapping.fields).includes(c.index) &&
      !locationCols.has(c.index) &&
      !categoryCols.has(c.index) &&
      !mapping.ignoredColumns?.some((ig) => ig.column === c.index),
  );

  function setField(field: FieldKey, value: string) {
    const fields = { ...mapping.fields };
    const index = value === "" ? undefined : Number(value);
    for (const k of FIELD_KEYS) if (fields[k] === index) delete fields[k];
    if (index === undefined) delete fields[field];
    else fields[field] = index;
    onChange({
      ...mapping,
      fields,
      locationColumns: mapping.locationColumns.filter((l) => l.column !== index),
      categoryColumns: mapping.categoryColumns.filter((c) => c.column !== index),
      ignoredColumns: mapping.ignoredColumns?.filter((ig) => ig.column !== index),
      // Choosing a real count column makes the start/received/used maths unnecessary.
      movements: field === "quantity" && index !== undefined ? undefined : mapping.movements,
    });
  }

  function setHeaderRow(value: number) {
    const guessed = guessMapping(rows, knownLocationNames);
    onChange(value === guessed.headerRow ? guessed : { ...mapping, headerRow: value });
  }

  const summary = [
    mapping.fields.name !== undefined && `names from “${columnName(rows, mapping, mapping.fields.name)}”`,
    mapping.locationColumns.length > 0 &&
      `${mapping.locationColumns.filter((l) => l.kind === "onHand").length} location column${mapping.locationColumns.length === 1 ? "" : "s"}`,
    mapping.fields.location !== undefined && `locations from “${columnName(rows, mapping, mapping.fields.location)}”`,
    mapping.fields.quantity !== undefined && `quantity from “${columnName(rows, mapping, mapping.fields.quantity)}”`,
  ].filter(Boolean);

  return (
    <details className="group rounded-2xl border border-border-hairline bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5">
        <div>
          <h2 className="font-semibold">Column matching</h2>
          <p className="mt-0.5 text-sm text-foreground-muted">
            {summary.length ? `We read ${summary.join(", ")}.` : "Tell us which column is which."} Open to
            adjust.
          </p>
        </div>
        <span className="text-foreground-muted transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="border-t border-border-hairline p-5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-foreground-muted">Column headings are on</span>
          <Select
            value={mapping.headerRow}
            onChange={(e) => setHeaderRow(Number(e.target.value))}
            className="h-9 w-auto"
          >
            <option value={-1}>No heading row</option>
            {rows.slice(0, 25).map((r, i) => (
              <option key={i} value={i}>
                Row {i + 1}: {r.filter(Boolean).slice(0, 4).join(", ").slice(0, 60)}
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {FIELD_KEYS.map((field) => (
            <label key={field} className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
                {FIELD_LABELS[field]}
                {field === "name" && " *"}
              </span>
              <Select value={mapping.fields[field] ?? ""} onChange={(e) => setField(field, e.target.value)}>
                <option value="">—</option>
                {columns.map((c) => (
                  <option key={c.index} value={c.index}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </label>
          ))}
        </div>

        {(mapping.ignoredColumns?.length ?? 0) > 0 && (
          <div className="mt-6">
            <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
              Left out on purpose
            </p>
            <p className="mt-1 text-sm text-foreground-muted">
              These columns have numbers but aren&rsquo;t places — like starting counts, stock
              received, used or wasted. They aren&rsquo;t counted as locations.
            </p>
            <ul className="mt-2 flex flex-col divide-y divide-border-hairline rounded-lg border border-border-hairline text-sm">
              {mapping.ignoredColumns!.map((ig) => (
                <li key={ig.column} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0">
                    <span className="font-medium">{columnName(rows, mapping, ig.column)}</span>{" "}
                    <span className="text-foreground-muted">
                      {ig.note.includes(" — ") ? ig.note.split(" — ").slice(1).join(" — ") : ig.note}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onChange({
                        ...mapping,
                        ignoredColumns: mapping.ignoredColumns!.filter((x) => x.column !== ig.column),
                        movements:
                          mapping.movements &&
                          [mapping.movements.start, ...mapping.movements.add, ...mapping.movements.subtract].includes(ig.column)
                            ? undefined
                            : mapping.movements,
                        locationColumns: [
                          ...mapping.locationColumns,
                          {
                            column: ig.column,
                            location: cleanLocationName(columnName(rows, mapping, ig.column)),
                            kind: "onHand",
                          },
                        ],
                      })
                    }
                  >
                    It&rsquo;s a location — count it
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
            Quantity columns per location
          </p>
          <p className="mt-1 text-sm text-foreground-muted">
            When each location has its own column of counts.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {mapping.locationColumns.map((lc, i) => (
              <div key={lc.column} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-40 truncate text-foreground-muted">{columnName(rows, mapping, lc.column)}</span>
                <span className="text-foreground-muted">→</span>
                <Input
                  value={lc.location}
                  onChange={(e) =>
                    onChange({
                      ...mapping,
                      locationColumns: mapping.locationColumns.map((x, j) =>
                        j === i ? { ...x, location: e.target.value } : x,
                      ),
                    })
                  }
                  className="h-9 w-48"
                />
                <Select
                  value={lc.kind}
                  onChange={(e) =>
                    onChange({
                      ...mapping,
                      locationColumns: mapping.locationColumns.map((x, j) =>
                        j === i ? { ...x, kind: e.target.value as "onHand" | "reorderPoint" } : x,
                      ),
                    })
                  }
                  className="h-9 w-auto"
                >
                  <option value="onHand">on hand</option>
                  <option value="reorderPoint">reorder point</option>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onChange({ ...mapping, locationColumns: mapping.locationColumns.filter((_, j) => j !== i) })
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
            {mapping.categoryColumns.map((cc) => (
              <div key={cc.column} className="flex items-center gap-2 text-sm">
                <span className="w-40 truncate text-foreground-muted">{columnName(rows, mapping, cc.column)}</span>
                <span className="text-foreground-muted">→ {cc.category} quantity</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onChange({ ...mapping, categoryColumns: mapping.categoryColumns.filter((c) => c.column !== cc.column) })
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
            {unusedForLocations.length > 0 && (
              <Select
                value=""
                onChange={(e) => {
                  const index = Number(e.target.value);
                  onChange({
                    ...mapping,
                    locationColumns: [
                      ...mapping.locationColumns,
                      { column: index, location: cleanLocationName(columnName(rows, mapping, index)), kind: "onHand" },
                    ],
                  });
                }}
                className="h-9 w-full sm:w-72"
              >
                <option value="">+ Add a location column…</option>
                {unusedForLocations.map((c) => (
                  <option key={c.index} value={c.index}>
                    {c.label}
                  </option>
                ))}
              </Select>
            )}
          </div>
        </div>
      </div>
    </details>
  );
}

function IssuesCard({ parsed }: { parsed: ParseResult }) {
  const all = [...parsed.skipped, ...parsed.notes].sort((a, b) => a.row - b.row);
  return (
    <details className="group rounded-2xl border border-border-hairline bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between p-5">
        <div>
          <h2 className="font-semibold">Notes on {all.length} row{all.length === 1 ? "" : "s"}</h2>
          <p className="mt-0.5 text-sm text-foreground-muted">
            {parsed.skipped.length} skipped · {parsed.notes.length} adjusted
          </p>
        </div>
        <span className="text-foreground-muted transition-transform group-open:rotate-180">▾</span>
      </summary>
      <ul className="max-h-72 overflow-auto border-t border-border-hairline px-5 py-3 text-sm">
        {all.map((issue, i) => (
          <li key={i} className="py-1">
            <span className="text-foreground-muted">Row {issue.row}:</span> {issue.message}
          </li>
        ))}
      </ul>
    </details>
  );
}

function ImportDone({ outcome, onAgain }: { outcome: Outcome; onAgain: () => void }) {
  return (
    <Card className="p-8 text-center">
      <h2 className="text-xl font-semibold">Import complete</h2>
      <p className="mt-3 text-foreground-muted">
        {outcome.created} new product{outcome.created === 1 ? "" : "s"}
        {outcome.firstNewCode &&
          ` (codes ${outcome.firstNewCode}${outcome.lastNewCode !== outcome.firstNewCode ? ` – ${outcome.lastNewCode}` : ""})`}
        , {outcome.updated} updated
        {outcome.locationsCreated.length > 0 &&
          `, and ${outcome.locationsCreated.length} new location${outcome.locationsCreated.length === 1 ? "" : "s"}: ${outcome.locationsCreated.join(", ")}`}
        .
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <LinkButton href="/dashboard/inventory">Go to inventory</LinkButton>
        <Button variant="secondary" onClick={onAgain}>
          Import another file
        </Button>
      </div>
    </Card>
  );
}

// ---------- Claude's reading ----------

type AiState =
  | { status: "reading" | "off" | "skipped" }
  | { status: "failed"; message?: string }
  | {
      status: "done";
      summary: string;
      mapping: ColumnMapping;
      hints: RowHints;
      explanations: ColumnExplanation[];
      applied: boolean;
    };

function aiHints(state: AiState | undefined): Partial<RowHints> | null {
  if (state?.status !== "done" || !state.applied) return null;
  return state.hints;
}

const ROLE_LABEL: Record<string, string> = {
  product_name: "Product name",
  backbar_or_retail: "Backbar / Retail",
  location_name: "Location",
  on_hand: "On hand (the count)",
  reorder_point: "Reorder point",
  brand: "Brand",
  vendor: "Vendor",
  unit: "Unit",
  case_pack: "Case pack",
  unit_cost: "Unit cost",
  vendor_sku: "Vendor SKU",
  invii_code: "invii code",
  location_on_hand: "Location count",
  location_reorder_point: "Location reorder point",
  backbar_on_hand: "Backbar count",
  retail_on_hand: "Retail count",
  starting_count: "Starting count",
  received: "Received",
  used_or_lost: "Used / lost",
  ignore: "Not used",
};

function ClaudeCard({
  tabs,
  rows,
  mappings,
  onUseStandard,
  onUseClaude,
  onSkip,
}: {
  tabs: { index: number; name: string; state: AiState | undefined }[];
  rows: Sheet[];
  mappings: ColumnMapping[];
  onUseStandard: (i: number) => void;
  onUseClaude: (i: number) => void;
  onSkip: () => void;
}) {
  const visible = tabs.filter((t) => t.state && t.state.status !== "off");
  if (visible.length === 0) return null;

  if (visible.some((t) => t.state?.status === "reading")) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3 border-brand/40 p-5" role="status" aria-live="polite">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-light opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-light" />
          </span>
          <div>
            <p className="font-medium">Claude is reading your sheet</p>
            <p className="text-sm text-foreground-muted">
              Checking every column and row — which ones are places, which are counts, and which to leave out.
            </p>
          </div>
        </div>
        <button onClick={onSkip} className="text-sm text-foreground-muted underline-offset-2 hover:text-foreground hover:underline">
          Skip and use the standard reader
        </button>
      </Card>
    );
  }

  return (
    <>
      {visible.map(({ index, name, state }) => {
        if (!state || state.status === "skipped" || state.status === "reading") return null;
        if (state.status === "failed") {
          return (
            <p key={index} className="px-1 text-xs text-foreground-muted">
              {tabs.length > 1 ? `${name}: ` : ""}
              {state.message ?? "Claude couldn't read this sheet — using the standard reader."}
            </p>
          );
        }
        if (state.status !== "done") return null;
        const sheet = rows[index];
        const mapping = mappings[index];
        return (
          <Card key={index} className="border-brand/40 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-brand-light">
                  {state.applied ? "Read by Claude" : "Claude's reading (not in use)"}
                  {tabs.length > 1 ? ` · ${name}` : ""}
                </p>
                <p className="mt-1.5 text-sm">{state.summary}</p>
              </div>
              {state.applied ? (
                <button onClick={() => onUseStandard(index)} className="text-xs text-foreground-muted hover:text-foreground hover:underline">
                  Use the standard reader instead
                </button>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => onUseClaude(index)}>
                  Use Claude&rsquo;s reading
                </Button>
              )}
            </div>
            <details className="group mt-3">
              <summary className="cursor-pointer list-none text-sm text-brand-light hover:underline">
                What each column means <span aria-hidden className="inline-block transition-transform group-open:rotate-180">▾</span>
              </summary>
              <ul className="mt-2 flex flex-col divide-y divide-border-hairline text-sm">
                {state.explanations.map((e) => (
                  <li key={e.column} className="grid gap-1 py-2 sm:grid-cols-[12rem_10rem_1fr] sm:gap-3">
                    <span className="truncate font-medium">{columnName(sheet.rows, mapping, e.column)}</span>
                    <span className={cn("text-xs sm:text-sm", e.role === "ignore" ? "text-foreground-muted" : "text-brand-light")}>
                      {ROLE_LABEL[e.role] ?? e.role}
                    </span>
                    <span className="text-foreground-muted">{e.explanation}</span>
                  </li>
                ))}
              </ul>
            </details>
          </Card>
        );
      })}
    </>
  );
}
