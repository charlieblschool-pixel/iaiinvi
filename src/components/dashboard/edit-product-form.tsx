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

export function EditProductForm({
  product,
  stockByLocation,
  locations,
  vendors,
  categories,
}: {
  product: {
    id: string;
    name: string;
    unitLabel: string;
    casePackSize: number;
    unitCost: number;
    avgWeeklyUsage: number;
    vendorId: string | null;
    categoryId: string | null;
  };
  stockByLocation: Record<string, { onHand: number; reorderPoint: number }>;
  locations: LocationOption[];
  vendors: VendorOption[];
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [categoryId, setCategoryId] = useState(product.categoryId ?? "");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);

    const stockLevels = locations
      .map((location) => ({
        locationId: location.id,
        onHand: Number(form.get(`onHand-${location.id}`) ?? 0),
        reorderPoint: Number(form.get(`reorderPoint-${location.id}`) ?? 0),
      }))
      .filter(
        (s) =>
          s.locationId in stockByLocation || s.onHand > 0 || s.reorderPoint > 0,
      );

    const body: Record<string, unknown> = {
      name: form.get("name"),
      unitLabel: form.get("unitLabel"),
      casePackSize: Number(form.get("casePackSize")),
      unitCost: Number(form.get("unitCost")),
      avgWeeklyUsage: Number(form.get("avgWeeklyUsage")),
      vendorId: form.get("vendorId") || null,
      stockLevels,
    };

    const submittedCategoryId = form.get("categoryId");
    if (submittedCategoryId === NEW_CATEGORY_VALUE) {
      body.newCategoryName = form.get("newCategoryName");
    } else {
      body.categoryId = submittedCategoryId || null;
    }

    const res = await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't save that product.");
      setLoading(false);
      return;
    }

    router.push("/dashboard/inventory");
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`Remove ${product.name} from inventory? This can't be undone.`)) {
      return;
    }
    setDeleting(true);
    const res = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
    if (!res.ok) {
      setDeleting(false);
      setError("Couldn't remove that product.");
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
        <Input id="name" name="name" required defaultValue={product.name} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="unitLabel">Unit</Label>
          <Input id="unitLabel" name="unitLabel" required defaultValue={product.unitLabel} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="casePackSize">Case pack size</Label>
          <Input
            id="casePackSize"
            name="casePackSize"
            type="number"
            min={1}
            defaultValue={product.casePackSize}
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
            defaultValue={product.unitCost}
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
            defaultValue={product.avgWeeklyUsage}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="categoryId">Brand / category</Label>
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
            placeholder="e.g. Unite"
            className="mt-1.5"
          />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="vendorId">Vendor</Label>
        <Select id="vendorId" name="vendorId" defaultValue={product.vendorId ?? ""}>
          <option value="">No vendor yet</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} — {v.leadTimeDays}d lead time
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Stock by location</Label>
        <div className="overflow-hidden rounded-lg border border-border-hairline">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-raised text-left text-xs uppercase tracking-wider text-foreground-muted">
                <th className="px-3 py-2 font-medium">Location</th>
                <th className="px-3 py-2 font-medium">On hand</th>
                <th className="px-3 py-2 font-medium">Reorder pt</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((location) => {
                const current = stockByLocation[location.id];
                const label = location.name !== LOCATION_LABELS[location.type]
                  ? location.name
                  : LOCATION_LABELS[location.type];
                return (
                  <tr key={location.id} className="border-t border-border-hairline">
                    <td className="px-3 py-2">{label}</td>
                    <td className="px-3 py-2">
                      <Input
                        name={`onHand-${location.id}`}
                        type="number"
                        min={0}
                        defaultValue={current?.onHand ?? 0}
                        className="w-24"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        name={`reorderPoint-${location.id}`}
                        type="number"
                        min={0}
                        defaultValue={current?.reorderPoint ?? 0}
                        className="w-24"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {error && <p className="text-sm text-status-bad">{error}</p>}

      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : "Save changes"}
          </Button>
          <LinkButton href="/dashboard/inventory" variant="secondary">
            Cancel
          </LinkButton>
        </div>
        <Button type="button" variant="danger" onClick={handleDelete} disabled={deleting}>
          {deleting ? "Removing…" : "Remove product"}
        </Button>
      </div>
    </form>
  );
}
