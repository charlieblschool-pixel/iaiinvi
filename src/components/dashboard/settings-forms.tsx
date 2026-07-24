"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function OrganizationNameForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    const res = await fetch("/api/settings/organization", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setStatus("saved");
      router.refresh();
      setTimeout(() => setStatus("idle"), 2000);
    } else {
      setStatus("idle");
    }
  }

  return (
    <Card className="p-6">
      <h2 className="font-semibold">Workspace name</h2>
      <form onSubmit={handleSubmit} className="mt-4 flex items-end gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="orgName">Name</Label>
          <Input
            id="orgName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={status === "saving"}>
          {status === "saved" ? "Saved" : status === "saving" ? "Saving…" : "Save"}
        </Button>
      </form>
    </Card>
  );
}

export function NewVendorForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("7");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, leadTimeDays }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't add that vendor.");
      return;
    }
    setName("");
    setLeadTimeDays("7");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3">
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="vendorName">Vendor name</Label>
        <Input
          id="vendorName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Salon Supply Co."
          required
        />
      </div>
      <div className="flex w-40 flex-col gap-1.5">
        <Label htmlFor="leadTimeDays">Lead time (days)</Label>
        <Input
          id="leadTimeDays"
          type="number"
          min={1}
          value={leadTimeDays}
          onChange={(e) => setLeadTimeDays(e.target.value)}
          required
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Adding…" : "Add vendor"}
      </Button>
      {error && <p className="text-sm text-status-bad">{error}</p>}
    </form>
  );
}

export function NewCategoryForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't add that category.");
      return;
    }
    setName("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3">
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="categoryName">Category name</Label>
        <Input
          id="categoryName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Retail hair care"
          required
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Adding…" : "Add category"}
      </Button>
      {error && <p className="text-sm text-status-bad">{error}</p>}
    </form>
  );
}

export function DeleteWorkspaceButton() {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const res = await fetch("/api/settings/delete-workspace", { method: "POST" });
    if (res.ok) {
      await signOut({ callbackUrl: "/" });
    } else {
      setLoading(false);
    }
  }

  if (!confirming) {
    return (
      <Button variant="danger" onClick={() => setConfirming(true)}>
        Delete workspace
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <p className="text-sm text-status-bad">
        This permanently deletes all products, stock, and history. Are you sure?
      </p>
      <Button variant="danger" disabled={loading} onClick={handleDelete}>
        {loading ? "Deleting…" : "Yes, delete everything"}
      </Button>
      <Button variant="secondary" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </div>
  );
}
