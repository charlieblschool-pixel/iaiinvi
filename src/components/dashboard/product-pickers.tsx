"use client";

import { useState } from "react";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { USAGE_CATEGORIES, usageCategoryFromName } from "@/lib/categories";
import { EXAMPLE_LOCATIONS } from "@/lib/locations";

type CategoryOption = { id: string; name: string };

const NEW_PREFIX = "new:";

/**
 * Backbar / Retail toggle (plus any extra categories the workspace added).
 * Value is a category id, or "new:<name>" when the workspace doesn't have
 * that built-in category yet.
 */
export function CategoryPicker({
  categories,
  value,
  onChange,
}: {
  categories: CategoryOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const builtIn = USAGE_CATEGORIES.map((name) => {
    const existing = categories.find((c) => usageCategoryFromName(c.name) === name);
    return { value: existing?.id ?? `${NEW_PREFIX}${name}`, label: name };
  });
  const extra = categories
    .filter((c) => !usageCategoryFromName(c.name))
    .map((c) => ({ value: c.id, label: c.name }));

  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {[...builtIn, ...extra].map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "h-11 min-w-28 rounded-lg border px-4 text-sm font-medium transition-all duration-150 active:scale-[0.97]",
            value === option.value
              ? "border-brand bg-brand/10 text-brand-light"
              : "border-border-hairline bg-surface-raised text-foreground-muted hover:border-white/40 hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Turns a CategoryPicker value into the API's categoryId / newCategoryName fields. */
export function categoryPayload(value: string): { categoryId?: string | null; newCategoryName?: string } {
  if (!value) return { categoryId: null };
  if (value.startsWith(NEW_PREFIX)) return { newCategoryName: value.slice(NEW_PREFIX.length) };
  return { categoryId: value };
}

const NEW_LOCATION = "__new__";

/** Location select with an inline "+ New location…" option. */
export function LocationPicker({
  locations,
}: {
  locations: { id: string; name: string }[];
}) {
  const [choice, setChoice] = useState(locations.length ? "" : NEW_LOCATION);

  return (
    <div className="flex flex-col gap-1.5">
      {locations.length > 0 && (
        <Select
          id="locationId"
          name={choice === NEW_LOCATION ? undefined : "locationId"}
          required
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
        >
          <option value="" disabled>
            Choose a location
          </option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
          <option value={NEW_LOCATION}>+ New location…</option>
        </Select>
      )}
      {choice === NEW_LOCATION && (
        <Input
          name="newLocationName"
          required
          autoFocus={locations.length > 0}
          placeholder={`e.g. ${EXAMPLE_LOCATIONS.slice(0, 3).join(", ")}`}
          maxLength={60}
        />
      )}
    </div>
  );
}
