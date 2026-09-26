// Reorder list math checks. Run with: npm run test:reorder
import { buildReorderList, engineOrderQuantity } from "@/lib/reorder-math";
let f = 0;
const eq = (l: string, a: unknown, e: unknown) => { const A = JSON.stringify(a), E = JSON.stringify(e); if (A !== E) { f++; console.log(`FAIL ${l}\n  got ${A}\n  exp ${E}`); } else console.log(`ok   ${l}`); };
const base = { id: "1", code: "P-0001", name: "X", brand: null, category: "Retail", unitLabel: "bottle", casePackSize: 6, unitCost: 10, avgWeeklyUsage: 0, vendor: { name: "V", leadTimeDays: 5 } };
// healthy → not listed
eq("healthy", buildReorderList([{ ...base, avgWeeklyUsage: 7, stocks: [{ locationName: "Floor", onHand: 40, reorderPoint: 5 }] }]).length, 0);
// below point, no usage → back to 2x point, whole cases
let l = buildReorderList([{ ...base, stocks: [{ locationName: "Floor", onHand: 2, reorderPoint: 5 }] }])[0];
eq("no usage qty", [l.urgency, l.quantity, l.cases], ["soon", 12, 2]);
// runs out before delivery → now
l = buildReorderList([{ ...base, avgWeeklyUsage: 14, stocks: [{ locationName: "Floor", onHand: 6, reorderPoint: 0 }] }])[0];
eq("runs out first", [l.urgency, l.quantity], ["now", 18]); // 2/day × 12 days = 24, minus 6 on hand = 18 (3 cases)
// zero with no signal → check, never "now"
l = buildReorderList([{ ...base, stocks: [{ locationName: "Floor", onHand: 0, reorderPoint: 0 }] }])[0];
eq("check", [l.urgency, l.quantity], ["check", 6]);
// never counted → skipped
eq("uncounted", buildReorderList([{ ...base, stocks: [] }]).length, 0);
// multi-location totals + low spot reason
l = buildReorderList([{ ...base, stocks: [{ locationName: "Floor", onHand: 1, reorderPoint: 2 }, { locationName: "Cabinet", onHand: 3, reorderPoint: 2 }] }])[0];
eq("multi", [l.onHand, l.reorderPoint, l.why.some((w) => w.includes("Low in Floor"))], [4, 4, true]);
// sorted: now before soon
const list = buildReorderList([
  { ...base, id: "a", name: "A", stocks: [{ locationName: "F", onHand: 2, reorderPoint: 5 }] },
  { ...base, id: "b", name: "B", avgWeeklyUsage: 14, stocks: [{ locationName: "F", onHand: 1, reorderPoint: 0 }] },
]);
eq("sort", list.map((x) => x.product.name), ["B", "A"]);
// engine math unchanged
eq("engine", engineOrderQuantity({ onHand: 6, reorderPoint: 8, avgWeeklyUsage: 8, leadTimeDays: 5, casePackSize: 12 }).quantity, 12);
console.log(f ? `${f} FAILED` : "ALL PASSED"); process.exit(f ? 1 : 0);
