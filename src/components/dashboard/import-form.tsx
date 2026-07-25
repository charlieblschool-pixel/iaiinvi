"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Button, LinkButton } from "@/components/ui/button";

const TARGET_FIELDS = [
  { key: "name", label: "Product name", required: true },
  { key: "category", label: "Category", required: false },
  { key: "unit", label: "Unit (bottle, jar…)", required: false },
  { key: "casePackSize", label: "Case pack size", required: false },
  { key: "unitCost", label: "Unit cost", required: false },
  { key: "vendorName", label: "Vendor", required: false },
  { key: "locationName", label: "Location", required: false },
  { key: "onHand", label: "On hand", required: false },
  { key: "reorderPoint", label: "Reorder point", required: false },
] as const;

type FieldKey = (typeof TARGET_FIELDS)[number]["key"];

const GUESS_KEYWORDS: Record<FieldKey, string[]> = {
  name: ["product", "name", "item", "sku"],
  category: ["category", "type", "group"],
  unit: ["unit", "uom"],
  casePackSize: ["case", "pack"],
  unitCost: ["cost", "price"],
  vendorName: ["vendor", "supplier", "brand"],
  locationName: ["location", "where", "storage"],
  onHand: ["on hand", "onhand", "qty", "quantity", "stock", "count"],
  reorderPoint: ["reorder", "min", "threshold", "par"],
};

function guessMapping(headers: string[]): Record<FieldKey, string> {
  const mapping = {} as Record<FieldKey, string>;
  for (const field of TARGET_FIELDS) {
    const match = headers.find((h) =>
      GUESS_KEYWORDS[field.key].some((kw) => h.toLowerCase().includes(kw)),
    );
    mapping[field.key] = match ?? "";
  }
  return mapping;
}

export function ImportForm() {
  const router = useRouter();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({} as Record<FieldKey, string>);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number } | null>(null);

  function handleFile(file: File) {
    setError(null);
    setResult(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const detectedHeaders = results.meta.fields ?? [];
        if (detectedHeaders.length === 0 || results.data.length === 0) {
          setError("Couldn't find any rows in that file. Make sure the first row has column headers.");
          return;
        }
        setHeaders(detectedHeaders);
        setRows(results.data);
        setMapping(guessMapping(detectedHeaders));
      },
      error: () => setError("Couldn't read that file. Please upload a CSV."),
    });
  }

  async function handleImport() {
    if (!mapping.name) {
      setError("Map a column to Product name before importing.");
      return;
    }
    setLoading(true);
    setError(null);

    const payload = rows.map((row) => {
      const mapped: Record<string, string> = {};
      for (const field of TARGET_FIELDS) {
        const source = mapping[field.key];
        if (source && row[source] !== undefined) {
          mapped[field.key] = row[source];
        }
      }
      return mapped;
    }).filter((r) => r.name?.trim());

    const res = await fetch("/api/import/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: payload }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Import failed. Please check your file and try again.");
      return;
    }
    setResult({ created: data.created, updated: data.updated ?? 0 });
    router.refresh();
  }

  if (result) {
    return (
      <Card className="p-6 text-center">
        <h2 className="font-semibold">
          {result.created} new product{result.created === 1 ? "" : "s"}
          {result.updated > 0
            ? `, ${result.updated} updated`
            : ""}
        </h2>
        <p className="mt-2 text-sm text-foreground-muted">
          Review reorder points and vendors in Inventory — anything without a
          clear location was placed in Storeroom. Products matching an
          existing name were updated instead of duplicated.
        </p>
        <LinkButton href="/dashboard/inventory" className="mt-6">
          Go to inventory
        </LinkButton>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-foreground-muted">
          Export your spreadsheet as CSV from Excel, Google Sheets, or
          Numbers, then upload it here.
        </p>
        <label className="mt-6 inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-light">
          Choose CSV file
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
        {error && <p className="mt-4 text-sm text-status-bad">{error}</p>}
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="font-semibold">Match your columns</h2>
      <p className="mt-1 text-sm text-foreground-muted">
        {rows.length} row{rows.length === 1 ? "" : "s"} found. We guessed the
        mapping below — adjust anything that&rsquo;s wrong.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {TARGET_FIELDS.map((field) => (
          <div key={field.key} className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
              {field.label}
              {field.required && " *"}
            </label>
            <Select
              value={mapping[field.key] ?? ""}
              onChange={(e) =>
                setMapping((m) => ({ ...m, [field.key]: e.target.value }))
              }
            >
              <option value="">Don&rsquo;t import</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </Select>
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border-hairline">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-surface-raised text-left text-foreground-muted">
              {headers.map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 3).map((row, i) => (
              <tr key={i} className="border-t border-border-hairline">
                {headers.map((h) => (
                  <td key={h} className="px-3 py-2 text-foreground-muted">
                    {row[h]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className="mt-4 text-sm text-status-bad">{error}</p>}

      <div className="mt-6 flex gap-3">
        <Button onClick={handleImport} disabled={loading}>
          {loading ? "Importing…" : `Import ${rows.length} product${rows.length === 1 ? "" : "s"}`}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setRows([]);
            setHeaders([]);
            setError(null);
          }}
        >
          Start over
        </Button>
      </div>
    </Card>
  );
}
