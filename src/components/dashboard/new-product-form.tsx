"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Label, Select } from "@/components/ui/input";
import { Button, LinkButton } from "@/components/ui/button";
import {
  CategoryPicker,
  LocationPicker,
  categoryPayload,
} from "@/components/dashboard/product-pickers";

type LocationOption = { id: string; name: string };
type VendorOption = { id: string; name: string; leadTimeDays: number };
type CategoryOption = { id: string; name: string };

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
  const [category, setCategory] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!category) {
      setError("Choose Backbar or Retail.");
      return;
    }
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const body = {
      ...(Object.fromEntries(form.entries()) as Record<string, string>),
      ...categoryPayload(category),
    };

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Couldn't add that product.");
        return;
      }
      router.push("/dashboard/inventory");
      router.refresh();
    } catch {
      setError("Couldn't reach invii.ai — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 flex flex-col gap-5 rounded-2xl border border-border-hairline bg-surface p-6"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Product name</Label>
        <Input id="name" name="name" required maxLength={200} placeholder="Blowout Creme" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Backbar or retail</Label>
        <CategoryPicker categories={categories} value={category} onChange={setCategory} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="brand">Brand</Label>
          <Input id="brand" name="brand" maxLength={100} placeholder="Oribe" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sku">Vendor SKU / UPC</Label>
          <Input id="sku" name="sku" maxLength={80} placeholder="Optional" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="unitLabel">Unit</Label>
          <Input id="unitLabel" name="unitLabel" required defaultValue="bottle" />
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
        <LocationPicker locations={locations} />
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

      <p className="text-xs text-foreground-muted">
        A permanent product code (like P-0042) is assigned when you save.
      </p>

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
