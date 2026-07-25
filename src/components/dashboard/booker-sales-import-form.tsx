"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Card } from "@/components/ui/card";
import { Select, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";

const TARGET_FIELDS = [
  { key: "productName", label: "Product / service name", required: true },
  { key: "quantity", label: "Quantity sold / used", required: true },
  { key: "category", label: "Category", required: false },
] as const;

type FieldKey = (typeof TARGET_FIELDS)[number]["key"];

const GUESS_KEYWORDS: Record<FieldKey, string[]> = {
  productName: ["product", "item", "service", "name", "sku"],
  quantity: ["qty", "quantity", "units", "sold", "count"],
  category: ["category", "type", "group"],
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

type SummaryRow = {
  productName: string;
  category: string | null;
  quantity: number;
  matched: boolean;
  newOnHand: number | null;
  newAvgWeeklyUsage: number | null;
};

export function BookerSalesImportForm() {
  const router = useRouter();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({} as Record<FieldKey, string>);
  const [periodDays, setPeriodDays] = useState(7);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<SummaryRow[] | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  function handleFile(file: File) {
    setError(null);
    setSummary(null);
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
    if (!mapping.productName || !mapping.quantity) {
      setError("Map both Product name and Quantity before importing.");
      return;
    }
    setLoading(true);
    setError(null);

    const payload = rows
      .map((row) => ({
        productName: mapping.productName ? row[mapping.productName] : undefined,
        quantity: mapping.quantity ? row[mapping.quantity] : undefined,
        category: mapping.category ? row[mapping.category] : undefined,
      }))
      .filter((r) => r.productName?.trim() && r.quantity !== undefined && r.quantity !== "");

    const res = await fetch("/api/import/booker-sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: payload, periodDays }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Sync failed. Please check your file and try again.");
      return;
    }
    setSummary(data.summary);
    setShowSummary(true);
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-foreground-muted">
          Export a product sales report from Booker as CSV, then upload it
          here to update stock and usage rates automatically.
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
    <>
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
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
              Days covered by this report
            </label>
            <Input
              type="number"
              min={1}
              max={90}
              value={periodDays}
              onChange={(e) => setPeriodDays(Number(e.target.value) || 7)}
            />
          </div>
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
            {loading ? "Syncing…" : `Sync ${rows.length} row${rows.length === 1 ? "" : "s"}`}
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

      <Modal
        open={showSummary}
        onClose={() => setShowSummary(false)}
        title="Booker sales synced"
      >
        <p className="mt-2 text-sm text-foreground-muted">
          {summary?.filter((s) => s.matched).length ?? 0} product
          {(summary?.filter((s) => s.matched).length ?? 0) === 1 ? "" : "s"}{" "}
          updated in inventory.
        </p>
        <div className="mt-4 max-h-96 overflow-y-auto rounded-lg border border-border-hairline">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-raised text-left text-foreground-muted">
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Sold / used</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {summary?.map((row, i) => (
                <tr key={i} className="border-t border-border-hairline">
                  <td className="px-3 py-2">{row.productName}</td>
                  <td className="px-3 py-2 text-foreground-muted">
                    {row.category ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-foreground-muted">
                    {row.quantity}
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={row.matched ? "good" : "bad"}>
                      {row.matched ? "Updated" : "Not in inventory"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex justify-end">
          <Button onClick={() => setShowSummary(false)}>Done</Button>
        </div>
      </Modal>
    </>
  );
}
