// Claude-reading → import mapping checks. Run with: npm run test:analysis
import Papa from "papaparse";
import { parseSheet } from "@/lib/import-parser";
import { mappingFromAnalysis } from "@/lib/sheet-analysis-mapping";
import type { SheetAnalysis } from "@/lib/sheet-analyst";

let failures = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failures++; console.log(`FAIL ${label}\n   got      ${a}\n   expected ${e}`); } else console.log(`ok   ${label}`);
}
const csv = (s: string) => Papa.parse<string[]>(s.trim()).data;
const summary = (rows: string[][], a: SheetAnalysis, known: string[] = [], def = "Storage") => {
  const m = mappingFromAnalysis(a, rows, known)!;
  const r = parseSheet(rows, m.mapping, { defaultLocation: def, ...m.hints });
  return { m, r, lines: r.products.map((p) => `${p.name} [${p.category ?? "?"}] ` + p.stocks.map((s) => `${s.location}=${s.onHand ?? "-"}`).join(", ")) };
};

// A monthly usage log: Claude says Initial/Received/Wasted are movements, Ending is the count.
const rows = csv(`
October usage log,,,,,
Item,Initial,Received,Wasted,Ending,Notes
TOP OF RETAIL SHELF,,,,,
Shampoo - retail,10,6,1,12,
Mask - retail,4,0,0,3,one dented
CABINENT,,,,,
Foils - backbar,50,0,2,31,
TOTAL,64,6,3,46,
`);
const analysis: SheetAnalysis = {
  headerRow: 1,
  columns: [
    { column: 0, role: "product_name", location: null, explanation: "Product names with backbar/retail in the name." },
    { column: 1, role: "starting_count", location: null, explanation: "What you had at the start of the month." },
    { column: 2, role: "received", location: null, explanation: "Deliveries during the month." },
    { column: 3, role: "used_or_lost", location: null, explanation: "Product thrown away — not a place." },
    { column: 4, role: "on_hand", location: null, explanation: "The end-of-month count — this is what's on the shelf." },
    { column: 5, role: "ignore", location: null, explanation: "Notes." },
    { column: 99, role: "location_on_hand", location: "Ghost", explanation: "out of range — must be ignored" },
  ],
  headingRows: [
    { row: 2, location: "Top of Retail Shelf", category: null },
    { row: 5, location: "Cabinent", category: "Backbar" },
  ],
  skipRows: [{ row: 7, reason: "a totals row" }],
  summary: "A monthly usage log grouped by location.",
};
let t = summary(rows, analysis, ["Cabinet"]);
eq("ending is the count; movements aren't places", t.lines, [
  "Shampoo [Retail] Top of Retail Shelf=12",
  "Mask [Retail] Top of Retail Shelf=3",
  "Foils [Backbar] Cabinet=31",
]);
eq("no fake locations", t.m.mapping.locationColumns.length, 0);
eq("movements listed as left out", t.m.mapping.ignoredColumns?.map((c) => c.column), [1, 2, 3, 5]);
eq("totals skipped with reason", t.r.skipped.map((s) => s.message), ['Skipped "TOTAL" — a totals row']);
eq("typo heading matched existing Cabinet", t.r.locations, ["Top of Retail Shelf", "Cabinet"]);

// No ending column: on-hand derived from the movements.
const noEnd = { ...analysis, columns: analysis.columns.filter((c) => c.column !== 4) };
t = summary(rows, noEnd, ["Cabinet"]);
eq("derived when no ending", t.lines, [
  "Shampoo [Retail] Top of Retail Shelf=15",
  "Mask [Retail] Top of Retail Shelf=4",
  "Foils [Backbar] Cabinet=48",
]);

// Wide sheet: Claude names the places; the reading is honoured exactly.
const wide = csv(`
Product,Nook,Drawer 2,Initial
Gel - retail,2,1,9
`);
t = summary(wide, {
  headerRow: 0,
  columns: [
    { column: 0, role: "product_name", location: null, explanation: "" },
    { column: 1, role: "location_on_hand", location: "The Nook", explanation: "Counts in the nook by the window." },
    { column: 2, role: "location_on_hand", location: "Drawer 2", explanation: "" },
    { column: 3, role: "starting_count", location: null, explanation: "" },
  ],
  headingRows: [],
  skipRows: [],
  summary: "",
});
eq("claude's places", t.lines, ["Gel [Retail] The Nook=2, Drawer 2=1"]);

// A reading without a product column is rejected → standard reader stays.
eq("unusable reading", mappingFromAnalysis({ ...analysis, columns: [] }, rows, []), null);

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
