// Pure reorder math shared by the reorder engine and the Reorder list report,
// so both always agree on "how many should we order and why".

import { roundUpToCasePack } from "@/lib/inventory";

export const SAFETY_BUFFER_DAYS = 7;
export const DEFAULT_LEAD_TIME_DAYS = 7;

/** The engine's per-suggestion quantity: cover lead time + safety buffer, whole cases. */
export function engineOrderQuantity({
  onHand,
  reorderPoint,
  avgWeeklyUsage,
  leadTimeDays,
  casePackSize,
  safetyBufferDays = SAFETY_BUFFER_DAYS,
}: {
  onHand: number;
  reorderPoint: number;
  avgWeeklyUsage: number;
  leadTimeDays: number;
  casePackSize: number;
  safetyBufferDays?: number;
}) {
  const coverageDays = leadTimeDays + safetyBufferDays;
  const dailyUsage = avgWeeklyUsage / 7;
  const targetQty = dailyUsage * coverageDays;
  const rawNeeded = Math.max(
    targetQty - onHand,
    avgWeeklyUsage > 0 ? 1 : reorderPoint - onHand + 1,
  );
  const quantity = Math.max(roundUpToCasePack(rawNeeded, casePackSize), casePackSize);
  return { quantity, rawNeeded, targetQty, coverageDays };
}

// ---------- Reorder list (Reports) ----------

export type ReorderInputProduct = {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  category: string | null;
  unitLabel: string;
  casePackSize: number;
  unitCost: number;
  avgWeeklyUsage: number;
  vendor: { name: string; leadTimeDays: number } | null;
  stocks: { locationName: string; onHand: number; reorderPoint: number }[];
};

export type Urgency = "now" | "soon" | "check";

export type ReorderLine = {
  product: ReorderInputProduct;
  urgency: Urgency;
  onHand: number;
  reorderPoint: number;
  quantity: number;
  cases: number | null;
  cost: number;
  daysOfCover: number | null;
  leadTimeDays: number;
  /** Plain-language reasons, in the order they matter. */
  why: string[];
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function formatDays(days: number) {
  if (days < 1) return "less than a day";
  const rounded = Math.round(days);
  return plural(rounded, "day");
}

/**
 * Decides which products need ordering, how many, and why. A product
 * qualifies when it's out, at/below its reorder point, or will run out
 * before a new order could arrive plus the safety buffer.
 */
export function buildReorderList(
  products: ReorderInputProduct[],
  { safetyBufferDays = SAFETY_BUFFER_DAYS }: { safetyBufferDays?: number } = {},
): ReorderLine[] {
  const lines: ReorderLine[] = [];

  for (const product of products) {
    if (product.stocks.length === 0) continue; // never counted — nothing to go on

    const onHand = product.stocks.reduce((s, x) => s + x.onHand, 0);
    const reorderPoint = product.stocks.reduce((s, x) => s + x.reorderPoint, 0);
    const unit = product.unitLabel || "unit";
    const leadTimeDays = product.vendor?.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS;
    const coverDays = leadTimeDays + safetyBufferDays;
    const dailyUsage = product.avgWeeklyUsage / 7;
    const daysOfCover = dailyUsage > 0 ? onHand / dailyUsage : null;

    const out = onHand <= 0;
    const belowPoint = reorderPoint > 0 && onHand <= reorderPoint;
    const runsOutFirst = daysOfCover !== null && daysOfCover < leadTimeDays;
    const lowCover = daysOfCover !== null && daysOfCover < coverDays;
    const hasSignal = reorderPoint > 0 || product.avgWeeklyUsage > 0;

    if (!out && !belowPoint && !lowCover) continue;

    const urgency: Urgency = !hasSignal ? "check" : out || runsOutFirst ? "now" : "soon";

    // How many: with usage data, cover lead time + buffer; without it, get
    // back to twice the reorder point; with neither, one case.
    let target: number;
    const usageTarget = dailyUsage * coverDays;
    const pointDriven = dailyUsage > 0 && reorderPoint + 1 > usageTarget;
    if (dailyUsage > 0) target = Math.max(usageTarget, reorderPoint + 1);
    else if (reorderPoint > 0) target = reorderPoint * 2;
    else target = product.casePackSize;
    const raw = Math.max(1, Math.ceil(target - onHand));
    const casePack = Math.max(1, product.casePackSize);
    const quantity = Math.max(Math.ceil(raw / casePack) * casePack, casePack);

    const why: string[] = [];
    const where = product.stocks
      .filter((s) => s.onHand > 0)
      .map((s) => `${s.locationName} ${s.onHand}`)
      .join(", ");
    if (out) {
      why.push(`Out of stock everywhere you keep it.`);
    } else {
      why.push(`${plural(onHand, unit)} on hand${where && product.stocks.length > 1 ? ` (${where})` : ""}.`);
    }
    if (belowPoint && !out) {
      why.push(`That's at or below your reorder point of ${reorderPoint}.`);
    }
    const lowSpots = product.stocks.filter((s) => s.reorderPoint > 0 && s.onHand <= s.reorderPoint);
    if (lowSpots.length > 0 && product.stocks.length > 1) {
      why.push(`Low in ${lowSpots.map((s) => s.locationName).join(", ")}.`);
    }
    if (daysOfCover !== null) {
      const perWeek = Number(product.avgWeeklyUsage.toFixed(1));
      why.push(
        out
          ? `You use about ${perWeek} a week.`
          : `You use about ${perWeek} a week, so what's left lasts ${formatDays(daysOfCover)}.`,
      );
    }
    why.push(
      `${product.vendor ? product.vendor.name : "Your vendor"} takes ${plural(leadTimeDays, "day")} to deliver${
        product.vendor ? "" : " (default — set a vendor for accuracy)"
      }${safetyBufferDays > 0 ? `, plus ${plural(safetyBufferDays, "day")} of safety stock` : ""}.`,
    );
    if (runsOutFirst && !out) {
      why.push(`At this pace you'd run out before a new order arrives.`);
    }
    if (pointDriven) {
      why.push(`You need about ${raw} more to get back above your reorder point of ${reorderPoint}.`);
    } else if (dailyUsage > 0) {
      why.push(
        `You need about ${raw} more to get through the next ${formatDays(coverDays)} (delivery${safetyBufferDays > 0 ? " + safety stock" : ""}) without running out.`,
      );
    } else if (reorderPoint > 0) {
      why.push(`No usage data yet, so this brings you back up to twice your reorder point (${reorderPoint * 2}) — ${raw} more.`);
    } else {
      why.push(`No reorder point or usage yet, so this suggests one case. Set a reorder point to make it smarter.`);
    }
    if (casePack > 1 && quantity !== raw) {
      why.push(`Rounded up to ${quantity} because it ships in cases of ${casePack}.`);
    }

    lines.push({
      product,
      urgency,
      onHand,
      reorderPoint,
      quantity,
      cases: casePack > 1 ? quantity / casePack : null,
      cost: quantity * product.unitCost,
      daysOfCover,
      leadTimeDays,
      why,
    });
  }

  const rank: Record<Urgency, number> = { now: 0, soon: 1, check: 2 };
  return lines.sort(
    (a, b) =>
      rank[a.urgency] - rank[b.urgency] ||
      (a.daysOfCover ?? (a.onHand <= 0 ? -1 : Infinity)) - (b.daysOfCover ?? (b.onHand <= 0 ? -1 : Infinity)) ||
      a.product.name.localeCompare(b.product.name),
  );
}
