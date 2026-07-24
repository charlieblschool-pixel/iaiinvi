"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Label, Select } from "@/components/ui/input";
import { Button, LinkButton } from "@/components/ui/button";
import { LOCATION_LABELS } from "@/lib/locations";
import type { LocationType } from "@/generated/prisma/enums";

type LocationOption = { id: string; name: string; type: LocationType };
type VendorOption = { id: string; name: string; leadTimeDays: number };
type CategoryOption = { id: string; name: string };

const NEW_CATEGORY_VALUE = "__new__";

export function NewProductForm({
  locations,
  vendors,
  categories,
}: {
  locations: LocationOption[];
  vendors: VendorOption[];
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [categoryId, setCategoryId] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(form.entries()) as Record<string, string>;
    if (body.categoryId === NEW_CATEGORY_VALUE) {
      delete body.categoryId;
    } else {
      delete body.newCategoryName;
    }

    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't add that product.");
      setLoading(false);
      return;
    }

    router.push("/dashboard/inventory");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 flex flex-col gap-5 rounded-2xl border border-border-hairline bg-surface p-6"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Product name</Label>
        <Input id="name" name="name" required placeholder="Pomade — Matte Finish" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="unitLabel">Unit</Label>
          <Input id="unitLabel" name="unitLabel" required placeholder="jar" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="casePackSize">Case pack size</Label>
          <Input
            id="casePackSize"
            name="casePackSize"
            type="number"
            min={1}
            defaultValue={1}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="unitCost">Unit cost ($)</Label>
          <Input
            id="unitCost"
            name="unitCost"
            type="number"
            min={0}
            step="0.01"
            defaultValue={0}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="avgWeeklyUsage">Avg weekly usage</Label>
          <Input
            id="avgWeeklyUsage"
            name="avgWeeklyUsage"
            type="number"
            min={0}
            step="0.1"
            defaultValue={0}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="categoryId">Category</Label>
        <Select
          id="categoryId"
          name="categoryId"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value={NEW_CATEGORY_VALUE}>+ New category…</option>
        </Select>
        {categoryId === NEW_CATEGORY_VALUE && (
          <Input
            name="newCategoryName"
            required
            placeholder="e.g. Retail hair care"
            className="mt-1.5"
          />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="vendorId">Vendor</Label>
        <Select id="vendorId" name="vendorId" defaultValue="">
          <option value="">No vendor yet</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} — {v.leadTimeDays}d lead time
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="locationId">Location</Label>
        <Select id="locationId" name="locationId" required defaultValue="">
          <option value="" disabled>
            Choose a location
          </option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name !== LOCATION_LABELS[l.type] ? l.name : LOCATION_LABELS[l.type]}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="onHand">On hand now</Label>
          <Input id="onHand" name="onHand" type="number" min={0} defaultValue={0} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reorderPoint">Reorder point</Label>
          <Input
            id="reorderPoint"
            name="reorderPoint"
            type="number"
            min={0}
            defaultValue={0}
            required
          />
        </div>
      </div>

      {error && <p className="text-sm text-status-bad">{error}</p>}

      <div className="mt-2 flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Adding…" : "Add product"}
        </Button>
        <LinkButton href="/dashboard/inventory" variant="secondary">
          Cancel
        </LinkButton>
      </div>
    </form>
  );
}
