// Track search checks. Run with: npm run test:tracking
import { searchProducts } from "@/lib/tracking";

let failures = 0;
function eq(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failures++; console.log(`FAIL ${label}\n   got      ${a}\n   expected ${e}`); } else console.log(`ok   ${label}`);
}
const p = (id: string, code: string, name: string, extra: { brand?: string; sku?: string; category?: string } = {}) =>
  ({ id, code, name, brand: extra.brand ?? null, sku: extra.sku ?? null, category: extra.category ?? "Retail" });
const products = [
  p("1", "P-0001", "Shampoo", { brand: "Redken", category: "Retail", sku: "884486123456" }),
  p("2", "P-0002", "Shampoo", { brand: "Redken", category: "Backbar" }),
  p("3", "P-0012", "Blowout Creme", { brand: "Oribe" }),
  p("4", "P-0120", "Conditioner", { brand: "Redken" }),
  p("5", "P-0013", "Color Developer 20 Vol", { category: "Backbar" }),
];
const ids = (q: string) => searchProducts(q, products).map((x) => x.id);

eq("exact code", ids("P-0012")[0], "3");
eq("code lowercase no dash", ids("p12")[0], "3");
eq("bare number", ids("12")[0], "3");
eq("barcode scan", ids("884486123456"), ["1"]);
eq("name prefix", ids("blow"), ["3"]);
eq("both shampoos", ids("shampoo").sort(), ["1", "2"]);
eq("brand + word", ids("redken cond"), ["4"]);
eq("typo", ids("condtioner"), ["4"]);
eq("typo 2", ids("shampo").length, 2);
eq("words any order", ids("20 developer"), ["5"]);
eq("nothing", ids("zzzz"), []);
eq("empty", ids("  "), []);

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
