import type { LocationType } from "@/generated/prisma/enums";
import { editDistance, normalizeText, tidyCase } from "@/lib/text-match";

// Labels for the legacy preset location kinds some older workspaces were
// created with. New locations are just names ("Top of Retail Shelf").
export const LOCATION_LABELS: Record<LocationType, string> = {
  STOREROOM: "Storeroom",
  RETAIL_SHELF: "Retail Shelf",
  BACKBAR: "Backbar / Prep",
  IN_USE: "In Use",
  WAREHOUSE: "Warehouse",
  DISPLAY: "Display",
  FRONT_COUNTER: "Front Counter",
  MOBILE_VAN: "Mobile / Van Stock",
  BACK_OFFICE: "Back Office",
};

/** Examples shown in empty states and placeholders. */
export const EXAMPLE_LOCATIONS = [
  "Top of Retail Shelf",
  "Retail Drawer",
  "Floor",
  "Cabinet",
  "Register",
];

/** Order locations the way the salon laid them out, then alphabetically. */
export const LOCATION_ORDER = [{ sortOrder: "asc" as const }, { name: "asc" as const }];

/**
 * Cleans a location name typed into a spreadsheet: strips "-----" / "===="
 * decorations and trailing colons, and fixes ALL CAPS.
 *   "TOP OF RETAIL SHELF -----" → "Top of Retail Shelf"
 */
export function cleanLocationName(raw: string): string {
  const stripped = raw
    .replace(/[‐-―]/g, "-")
    .replace(/^[\s\-=_*#~.:>|]+|[\s\-=_*#~.:<|]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return tidyCase(stripped).slice(0, 60);
}

const STOP_WORDS = new Set(["the", "of", "a", "an", "on", "in", "at"]);

/** Comparison key: "Top of the Retail Shelf" and "top retail shelf" match. */
export function locationKey(name: string): string {
  return normalizeText(cleanLocationName(name))
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(" ")
    .filter((w) => w && !STOP_WORDS.has(w))
    .join("");
}

/**
 * Finds the existing location a spreadsheet label refers to — exact after
 * normalizing, or a close typo ("Cabinent" → "Cabinet"). Labels that differ
 * only by a number ("Shelf 1" vs "Shelf 2") never fuzzy-match.
 */
export function findLocationMatch<T extends { name: string }>(
  label: string,
  locations: T[],
): T | undefined {
  const key = locationKey(label);
  if (!key) return undefined;
  const exact = locations.find((l) => locationKey(l.name) === key);
  if (exact) return exact;

  const digits = key.replace(/\D/g, "");
  const allowed = key.length >= 8 ? 2 : key.length >= 5 ? 1 : 0;
  if (allowed === 0) return undefined;

  let best: { location: T; distance: number } | undefined;
  let tie = false;
  for (const location of locations) {
    const other = locationKey(location.name);
    if (other.replace(/\D/g, "") !== digits) continue;
    const distance = editDistance(key, other);
    if (distance > allowed) continue;
    if (!best || distance < best.distance) {
      best = { location, distance };
      tie = false;
    } else if (distance === best.distance) {
      tie = true;
    }
  }
  return best && !tie ? best.location : undefined;
}
