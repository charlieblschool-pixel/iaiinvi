import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

// Claude reads an uploaded spreadsheet the way a person would and says what
// every column and odd row means. The deterministic parser then does the
// actual counting with that reading — Claude never invents numbers.

export const COLUMN_ROLES = [
  "product_name",
  "backbar_or_retail",
  "location_name",
  "on_hand",
  "reorder_point",
  "brand",
  "vendor",
  "unit",
  "case_pack",
  "unit_cost",
  "vendor_sku",
  "invii_code",
  "location_on_hand",
  "location_reorder_point",
  "backbar_on_hand",
  "retail_on_hand",
  "starting_count",
  "received",
  "used_or_lost",
  "ignore",
] as const;

export const SheetAnalysisSchema = z.object({
  headerRow: z.number().int().describe("Index (r) of the column-heading row, or -1 if the sheet has none"),
  columns: z.array(
    z.object({
      column: z.number().int().describe("Zero-based column index (A = 0)"),
      role: z.enum(COLUMN_ROLES),
      location: z
        .string()
        .nullable()
        .describe("For location_on_hand / location_reorder_point: the place's name, else null"),
      explanation: z.string().describe("One short plain-language sentence for a salon owner"),
    }),
  ),
  headingRows: z.array(
    z.object({
      row: z.number().int(),
      location: z.string().nullable(),
      category: z.enum(["Backbar", "Retail"]).nullable(),
    }),
  ),
  skipRows: z.array(z.object({ row: z.number().int(), reason: z.string() })),
  summary: z.string().describe("Two or three sentences describing how the sheet is laid out"),
});

export type SheetAnalysis = z.infer<typeof SheetAnalysisSchema>;

const SYSTEM_PROMPT = `You read inventory spreadsheets uploaded by hair salons and barbershops to invii.ai, an inventory app. Your job is to say what each column and each unusual row means, so the app can import the sheet correctly. You never count or change numbers yourself.

How invii.ai models inventory:
- Every product is either Backbar (used on clients during services) or Retail (sold to clients). Salons often put this in the product name, e.g. "Blowout Creme - backbar" or "Shampoo (retail)", or in a column.
- A location is a physical place where stock sits: "Top of Retail Shelf", "Retail Drawer", "Floor", "Cabinet", "Register", "Color Closet", "Suite 3", "Van". Only these are locations.
- Each product has an on-hand count per location, and optionally a reorder point (par / minimum).

Column roles:
- product_name: the product's name.
- backbar_or_retail: a column saying Backbar or Retail (or codes like BB / R).
- location_name: a column whose cells name the location of each row.
- on_hand: the single current physical count — the ending / closing / remaining / current / actual count. When a sheet has both a starting and an ending count, the ending one is on_hand.
- reorder_point: par, minimum, reorder point, reorder level.
- brand, vendor (supplier/distributor), unit (bottle, tube, jar), case_pack (units per case), unit_cost (wholesale cost per unit — not retail price), vendor_sku (SKU / UPC / item #), invii_code (codes like P-0001).
- location_on_hand: a column of counts for one specific place — its heading names that place. Put the place's name in "location", matching an existing workspace location's exact spelling when it's clearly the same place (including typos like "Cabinent" for "Cabinet").
- location_reorder_point: a par/minimum column for one specific place ("Floor Par").
- backbar_on_hand / retail_on_hand: count columns headed just "Backbar" or "Retail".
- starting_count: an opening / initial / beginning / last count — what was there before the period.
- received: stock that arrived during the period (received, delivered, purchased).
- used_or_lost: stock that left during the period (used, sold, wasted, damaged, expired, returned, samples, testers).
- ignore: anything else — retail price, value, variance, expected, order quantity, back order, notes, dates, totals, empty columns.

Critical rules:
- Stock-movement columns (Initial, Received, Used, Wasted, Sold, Damaged, Ending, Variance…) are NEVER locations, even when they hold numbers.
- Only use location_on_hand when the heading genuinely names a place. If unsure, choose ignore and say why.
- A column of numbers with an unclear heading is ignore, not a location.

Rows (identified by their r number):
- headingRows: rows that label the group of products below them rather than being a product — e.g. "TOP OF RETAIL SHELF -----", "Location: Floor", "BACKBAR". Give the location and/or category the heading sets (null for whichever it doesn't set).
- skipRows: rows that are not products and not headings — totals, subtotals, notes, instructions, dates, repeated column headings, signatures.
- Don't list ordinary product rows.

Write explanations and the summary in plain, friendly language for a busy salon owner. List every column that has any content.`;

export class SheetAnalystUnavailableError extends Error {}

export function sheetAnalystEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;

function getClient() {
  if (!sheetAnalystEnabled()) throw new SheetAnalystUnavailableError("ANTHROPIC_API_KEY is not set");
  client ??= new Anthropic({ timeout: 55_000, maxRetries: 1 });
  return client;
}

const MAX_CELL = 80;
const colLetter = (i: number) => {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

/** Renders rows compactly: "r4 | A: Shampoo - retail | C: 3". Blank cells are omitted. */
function renderRows(rows: string[][]): string {
  return rows
    .map((row, r) => {
      const cells = row
        .map((value, c) => ({ value: (value ?? "").replace(/\s+/g, " ").trim(), c }))
        .filter((x) => x.value)
        .map((x) => `${colLetter(x.c)}(${x.c}): ${x.value.slice(0, MAX_CELL)}`);
      return `r${r} | ${cells.length ? cells.join(" | ") : "(blank)"}`;
    })
    .join("\n");
}

export async function analyzeSheet({
  sheetName,
  rows,
  knownLocations,
}: {
  sheetName: string;
  rows: string[][];
  knownLocations: string[];
}): Promise<SheetAnalysis> {
  const response = await getClient().beta.messages.parse({
    model: "claude-opus-5",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: betaZodOutputFormat(SheetAnalysisSchema) },
    // If a request is ever declined, the API retries it on a fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          `Sheet name: ${sheetName}`,
          `Existing workspace locations: ${knownLocations.length ? knownLocations.join(", ") : "(none yet)"}`,
          `Rows (r = row index, then column letter(index): value):`,
          renderRows(rows),
        ].join("\n\n"),
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new Error("Claude declined to read this sheet");
  if (response.stop_reason === "max_tokens") throw new Error("Claude's reading was cut off");
  if (!response.parsed_output) throw new Error("Claude's reading couldn't be parsed");
  return response.parsed_output;
}
