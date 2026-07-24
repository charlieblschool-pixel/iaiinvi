export type StockTone = "good" | "warn" | "bad";

export function stockStatus(
  onHand: number,
  reorderPoint: number,
): { tone: StockTone; label: string } {
  if (onHand <= 0) return { tone: "bad", label: "Out of Stock" };
  if (onHand <= reorderPoint) return { tone: "warn", label: "Reorder Soon" };
  return { tone: "good", label: "Healthy" };
}

export function roundUpToCasePack(quantity: number, casePackSize: number): number {
  if (casePackSize <= 1) return Math.ceil(quantity);
  return Math.ceil(quantity / casePackSize) * casePackSize;
}
