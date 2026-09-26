// Spreadsheet import parser checks. Run with: npm run test:import
import Papa from "papaparse";
import { guessMapping, parseSheet, unstackSideBySide } from "@/lib/import-parser";
import { parseCount } from "@/lib/text-match";
import { splitCategoryFromName } from "@/lib/categories";
import { findLocationMatch, cleanLocationName } from "@/lib/locations";

let failures = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failures++; console.log(`FAIL ${label}\n   got      ${a}\n   expected ${e}`); }
  else console.log(`ok   ${label}`);
}
const csv = (s: string) => Papa.parse<string[]>(s.trim(), { skipEmptyLines: false }).data;
function run(label: string, text: string, defaultLocation = "Storage") {
  const rows = csv(text);
  const mapping = guessMapping(rows);
  const result = parseSheet(rows, mapping, { defaultLocation });
  return { mapping, result, summary: result.products.map((p) => `${p.name} [${p.category ?? "?"}] ` + p.stocks.map((s) => `${s.location}=${s.onHand ?? "-"}${s.reorderPoint !== undefined ? "/rp" + s.reorderPoint : ""}`).join(", ")) };
}

// --- name splitting ---
const cases: [string, string, string | null][] = [
  ["Blowout creme - backbar", "Blowout creme", "Backbar"],
  ["shampoo - retail", "shampoo", "Retail"],
  ["Shampoo – Retail", "Shampoo", "Retail"],
  ["Shampoo (retail)", "Shampoo", "Retail"],
  ["[Backbar] Color Gloss", "Color Gloss", "Backbar"],
  ["RETAIL | Dry Shampoo", "Dry Shampoo", "Retail"],
  ["Shampoo retail", "Shampoo", "Retail"],
  ["Blowout Creme Back Bar", "Blowout Creme", "Backbar"],
  ["Blowout creme -backbar", "Blowout creme", "Backbar"],
  ["Blowout creme-backbar", "Blowout creme-backbar", null], // no space → ambiguous, left alone
  ["Blowout creme - back bar", "Blowout creme", "Backbar"],
  ["Shampoo - retial", "Shampoo", "Retail"],
  ["Shampoo - backbr", "Shampoo", "Backbar"],
  ["Shampoo - Professional", "Shampoo", "Backbar"],
  ["Anti-Frizz Serum", "Anti-Frizz Serum", null],
  ["Redken - All Soft Shampoo - backbar - 1L", "Redken - All Soft Shampoo - 1L", "Backbar"],
  ["Retail Bag", "Retail Bag", null],
  ["Detail Brush - retail", "Detail Brush", "Retail"],
  ["Shampoo 8oz/250ml", "Shampoo 8oz/250ml", null],
  ["retail", "retail", null],
  ["Bleach (BB)", "Bleach", "Backbar"],
  ["[RT] Dry Shampoo", "Dry Shampoo", "Retail"],
  ["Moroccanoil(R) Treatment", "Moroccanoil(R) Treatment", null],
  ["Treatment (R)", "Treatment (R)", null],
];
for (const [input, name, cat] of cases) eq(`split "${input}"`, splitCategoryFromName(input), { name, category: cat });

// --- location matching ---
const locs = [{ name: "Cabinet" }, { name: "Top of Retail Shelf" }, { name: "Shelf 1" }];
eq("loc typo cabinent", findLocationMatch("cabinent", locs)?.name, "Cabinet");
eq("loc stopwords", findLocationMatch("top of the retail shelf", locs)?.name, "Top of Retail Shelf");
eq("loc digits differ", findLocationMatch("Shelf 2", locs)?.name, undefined);
eq("loc clean", cleanLocationName("TOP OF RETAIL SHELF -----"), "Top of Retail Shelf");
eq("loc clean colon", cleanLocationName("Retail drawer:"), "Retail Drawer");

// 1. Section headings with dashes (the user's layout)
let t = run("sections", `
Product,Qty
TOP OF RETAIL SHELF -----,
Shampoo - retail,4
Conditioner - retail,3
Retail drawer-----,
Blowout creme - backbar,2
Shampoo - retail,1
Floor,
Color developer - backbar,6
-----,
Cabinent -----,
Foils - backbar,10
Register,
Dry shampoo (retail),5
`);
eq("sections products", t.summary, [
  "Shampoo [Retail] Top of Retail Shelf=4, Retail Drawer=1",
  "Conditioner [Retail] Top of Retail Shelf=3",
  "Blowout creme [Backbar] Retail Drawer=2",
  "Color developer [Backbar] Floor=6",
  "Foils [Backbar] Cabinent=10",
  "Dry shampoo [Retail] Register=5",
]);
eq("sections locations", t.result.locations, ["Top of Retail Shelf", "Retail Drawer", "Floor", "Cabinent", "Register"]);

// 2. Wide: one column per location, with title rows above
t = run("wide", `
Salon inventory count,,,,,,
September 2026,,,,,,
Item,Top of Retail Shelf,Retail Drawer,Floor,Cabinet,Register,Retail Price
Shampoo - retail,4,2,,,1,$28.00
Blowout creme - backbar,,,3,5,,$0
Total,4,2,3,5,1,
`);
eq("wide header row", t.mapping.headerRow, 2);
eq("wide products", t.summary, [
  "Shampoo [Retail] Top of Retail Shelf=4, Retail Drawer=2, Register=1",
  "Blowout creme [Backbar] Floor=3, Cabinet=5",
]);
eq("wide skipped totals", t.result.skipped.length, 1);

// 3. Long format with a Location column + par + cost + brand
t = run("long", `
Product Name,Brand,Location,On Hand,Par,Unit Cost,Vendor,SKU
Blowout Creme - backbar,Oribe,Cabinet,3,2,$18.50,SalonCentric,OR-123
Blowout Creme - backbar,Oribe,Floor,1,1,$18.50,SalonCentric,OR-123
Shampoo - retail,Redken,top of the retail shelf,6,4,12,SalonCentric,RD-1
Shampoo - backbar,Redken,cabinet,2,1,20,SalonCentric,RD-2
`);
eq("long mapping", t.mapping.fields, { sku: 7, unitCost: 5, reorderPoint: 4, vendor: 6, brand: 1, location: 2, quantity: 3, name: 0 });
eq("long products", t.summary, [
  "Blowout Creme [Backbar] Cabinet=3/rp2, Floor=1/rp1",
  "Shampoo [Retail] Top of the Retail Shelf=6/rp4",
  "Shampoo [Backbar] Cabinet=2/rp1",
]);
eq("long fields", [t.result.products[0].brand, t.result.products[0].unitCost, t.result.products[0].sku, t.result.products[0].vendor], ["Oribe", 18.5, "OR-123", "SalonCentric"]);

// 4. Category column instead of suffix; no location info → default
t = run("category column", `
Product,Type,Quantity
Blowout creme,Backbar,3
Shampoo,Retail,2
Gloss,Color,1
`, "Cabinet");
eq("category column", t.summary, ["Blowout creme [Backbar] Cabinet=3", "Shampoo [Retail] Cabinet=2", "Gloss [?] Cabinet=1"]);
eq("used default", t.result.usedDefaultLocation, true);

// 5. Backbar/Retail quantity columns
t = run("category qty columns", `
Product,Backbar,Retail
Shampoo,2,5
Mask,,3
`, "Floor");
eq("category qty columns", t.summary, ["Shampoo [Backbar] Floor=2", "Shampoo [Retail] Floor=5", "Mask [Retail] Floor=3"]);

// 6. Wide with per-location par columns (our own export format)
t = run("export roundtrip", `
Code,Product,Category,Brand,Vendor,Unit,Case pack,Unit cost,SKU,Floor,Floor reorder pt,Cabinet,Cabinet reorder pt
P-0001,Blowout Creme,Backbar,Oribe,SalonCentric,bottle,6,18.5,OR-1,3,2,5,1
P-0002,Shampoo,Retail,,,bottle,1,12,,,,4,
`);
eq("roundtrip products", t.summary, ["Blowout Creme [Backbar] Floor=3/rp2, Cabinet=5/rp1", "Shampoo [Retail] Cabinet=4"]);
eq("roundtrip code", t.result.products.map((p) => p.code), ["P-0001", "P-0002"]);
eq("roundtrip casepack/unit", [t.result.products[0].casePackSize, t.result.products[0].unit], [6, "bottle"]);

// 7. No header row at all
t = run("headerless", `
Shampoo - retail,4
Blowout creme - backbar,2
`);
eq("headerless", t.summary, ["Shampoo [Retail] Storage=4", "Blowout creme [Backbar] Storage=2"]);

// 8. Plain section words (not caps, not decorated) + product with blank qty + messy numbers
t = run("plain sections", `
Product,Count
Retail drawer,
Shampoo - retail,"1,200"
Serum - retail,
Mask - retail,n/a
Cabinet,
Foils - backbar,-3
`);
eq("plain sections", t.summary, ["Shampoo [Retail] Retail Drawer=1200", "Serum [Retail] Retail Drawer=-", "Mask [Retail] Retail Drawer=-", "Foils [Backbar] Cabinet=0"]);
eq("plain notes", t.result.notes.length, 2);

// 9. Category sections + location sections
t = run("category sections", `
Product,Qty
BACKBAR,
Floor,
Foils,10
RETAIL,
Top of retail shelf,
Shampoo,3
`);
eq("category sections", t.summary, ["Foils [Backbar] Floor=10", "Shampoo [Retail] Top of Retail Shelf=3"]);

// 10. Repeated header rows mid-sheet
t = run("repeated header", `
Product,Qty
Shampoo - retail,1
Product,Qty
Mask - retail,2
`);
eq("repeated header", t.summary, ["Shampoo [Retail] Storage=1", "Mask [Retail] Storage=2"]);

// 11. Product column named "Description", quantity "In Stock", Retail Price present, Size column
t = run("misc headers", `
Description,Size,Retail Price,Cost,In Stock
Shampoo - retail,8 oz,28,14,5
`);
eq("misc headers mapping", t.mapping.fields, { unitCost: 3, quantity: 4, name: 0 });
eq("misc headers locations", t.mapping.locationColumns, []);

// 12. Location names containing quantity words survive the round trip
{
  const rows = csv(`Code,Product,Category,Mobile / Van Stock qty,Mobile / Van Stock reorder pt,Floor Qty,Stock Room
P-0001,Foils,Backbar,3,1,2,4`);
  const m = guessMapping(rows, ["Mobile / Van Stock", "Stock Room"]);
  eq("affix locations", m.locationColumns.map((l) => `${l.location}:${l.kind}`), ["Mobile / Van Stock:onHand", "Floor:onHand", "Stock Room:onHand", "Mobile / Van Stock:reorderPoint"]);
}

// 13. Several "<place> Qty" columns + a real global "Qty On Hand" elsewhere never collide
t = run("place qty", `
Item,Floor Qty,Cabinet Qty,Retail Qty
Foils,2,3,
Shampoo,,,5
`);
eq("place qty", t.summary, ["Foils [?] Floor=2, Cabinet=3", "Shampoo [Retail] Storage=5"]);
t = run("in stock", `
Item,In Stock,Qty On Hand
Foils - backbar,2,
`);
eq("in stock is global", t.mapping.fields.quantity, 1);

// ---- Round 2 improvements ----
eq("count 3+2", parseCount("3+2")?.value, 5);
eq("count half", parseCount("1/2")?.value, 0.5);
eq("count 1 1/2", parseCount("1 1/2")?.value, 1.5);
eq("count ½", parseCount("2½")?.value, 2.5);
eq("count 4 btl", parseCount("4 btl")?.value, 4);
eq("count cases", parseCount("2 cs"), { value: 2, inCases: true });
eq("count n/a", parseCount("n/a"), undefined);

// Merged / fill-down location + short category codes + numbered names
t = run("fill down", `
Location,Type,Product,Qty
Floor,BB,1. Foils,10
,,2. Developer,4
Cabinet,R,• Shampoo,3
,,- Mask,2
`);
eq("fill down", t.summary, ["Foils [Backbar] Floor=10", "Developer [Backbar] Floor=4", "Shampoo [Retail] Cabinet=3", "Mask [Retail] Cabinet=2"]);

// Fractions, sums, cases with case pack
t = run("counts", `
Product,Case pack,Qty
Shampoo - retail,6,3+2
Serum - retail,6,1/2
Foils - backbar,12,2 cases
`, "Floor");
eq("counts", t.summary, ["Shampoo [Retail] Floor=5", "Serum [Retail] Floor=1", "Foils [Backbar] Floor=24"]);

// "Location: Floor" headings
t = run("location prefix heading", `
Product,Qty
Location: Floor,
Foils - backbar,3
Area - Top Shelf,
Shampoo - retail,1
`);
eq("location prefix heading", t.summary, ["Foils [Backbar] Floor=3", "Shampoo [Retail] Top Shelf=1"]);

// Location cell carrying a category
t = run("location with category", `
Product,Location,Qty
Shampoo,Retail - Top Shelf,2
Foils,Backbar - Cabinet,9
`);
eq("location with category", t.summary, ["Shampoo [Retail] Top Shelf=2", "Foils [Backbar] Cabinet=9"]);

// Side-by-side lists
{
  const rows = csv(`
Product,Qty,,Product,Qty
TOP SHELF ---,,,CABINET ---,
Shampoo - retail,2,,Foils - backbar,9
Mask - retail,1,,Developer - backbar,4
`);
  const un = unstackSideBySide(rows)!;
  const r = parseSheet(un.rows, guessMapping(un.rows), { defaultLocation: "Storage", rowNumbers: un.rowNumbers });
  eq("side by side", r.products.map((p) => `${p.name} [${p.category}] ${p.stocks.map((s) => s.location + "=" + s.onHand).join(",")} r${p.rows[0]}`), [
    "Shampoo [Retail] Top Shelf=2 r3", "Mask [Retail] Top Shelf=1 r4", "Foils [Backbar] Cabinet=9 r3", "Developer [Backbar] Cabinet=4 r4",
  ]);
  eq("not side by side", unstackSideBySide(csv(`Product,Qty\nShampoo,1`)), null);
}

// ---- Round 3: movement columns are never locations ----
t = run("movements with ending", `
Product,Initial,Received,Used,Wasted,Ending,Retail Price
Shampoo - retail,10,6,4,1,11,28
Foils - backbar,50,0,20,2,28,0
`, "Cabinet");
eq("ending wins, no fake locations", t.summary, ["Shampoo [Retail] Cabinet=11", "Foils [Backbar] Cabinet=28"]);
eq("movement columns listed as ignored", t.mapping.ignoredColumns?.map((c) => c.reason), ["movement", "movement", "movement", "movement", "noise"]);
eq("no location columns", t.mapping.locationColumns.length, 0);

t = run("derive on hand", `
Product,Initial Count,Received,Used,Wasted,Sold
Shampoo - retail,10,6,,1,4
Mask - retail,3,,,,
Serum - retail,,5,,,
`, "Floor");
eq("derived", t.summary, ["Shampoo [Retail] Floor=11", "Mask [Retail] Floor=3", "Serum [Retail] Floor=-"]);
eq("derive note", t.result.notes[0]?.message.startsWith("No ending count column"), true);

t = run("count plus waste", `
Item,Initial,Wasted,Count
Gel - retail,9,1,7
`, "Floor");
eq("count column wins", t.summary, ["Gel [Retail] Floor=7"]);

t = run("unknown numbers ignored", `
Product,Floor,Cabinet,Week 3,Suite 2
Foils - backbar,2,3,99,4
`);
eq("only real places", t.mapping.locationColumns.map((l) => l.location), ["Floor", "Cabinet", "Suite 2"]);
eq("unknown listed", t.mapping.ignoredColumns?.map((c) => c.note.split(" — ")[0]), ["Week 3"]);

t = run("noise and order qty", `
Product,On Hand,Par,Reorder Qty,Variance,Back Order,Current Price
Foils - backbar,4,2,12,-1,3,9.5
`, "Cabinet");
eq("noise", [t.summary, t.mapping.fields.quantity, t.mapping.fields.reorderPoint], [["Foils [Backbar] Cabinet=4/rp2"], 1, 2]);

t = run("known custom place", `
Product,The Nook,Initial
Foils - backbar,2,9
`);
{
  const rows = csv(`Product,The Nook,Initial\nFoils - backbar,2,9`);
  const m = guessMapping(rows, ["The Nook"]);
  eq("existing location name counts", m.locationColumns.map((l) => l.location), ["The Nook"]);
  eq("without it, not a place", guessMapping(rows).locationColumns.length, 0);
}

// Notes scribbled into the product column are skipped; real products survive.
t = run("notes", `
Product,Qty
Gel - retail,2
remember to restock friday,
Note: count the van too,
Order Up Gel - retail,1
Check Mate Clay,3
call SalonCentric about the late delivery!!,
`);
eq("notes skipped", t.summary.map((l) => l.split(" [")[0]), ["Gel", "Order Up Gel", "Check Mate Clay"]);
eq("notes reported", t.result.skipped.length, 3);

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
