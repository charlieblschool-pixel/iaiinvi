// Date ranges and totals for Reports → Sold & wasted.

export const RANGES = {
  "7": { label: "Last 7 days", days: 7 },
  "30": { label: "Last 30 days", days: 30 },
  "90": { label: "Last 90 days", days: 90 },
  month: { label: "This month", days: null },
  all: { label: "All time", days: null },
} as const;
export type RangeKey = keyof typeof RANGES;

export function parseRange(value: string | string[] | undefined): RangeKey {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v in RANGES ? (v as RangeKey) : "30";
}

export function rangeStart(range: RangeKey, now = new Date()): Date | null {
  if (range === "all") return null;
  if (range === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  return new Date(now.getTime() - RANGES[range].days! * 24 * 60 * 60 * 1000);
}
