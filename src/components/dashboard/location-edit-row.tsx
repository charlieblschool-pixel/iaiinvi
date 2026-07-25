"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function LocationEditChip({
  id,
  name,
  typeLabel,
}: {
  id: string;
  name: string;
  typeLabel: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || value.trim() === name) {
      setEditing(false);
      setValue(name);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/locations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: value.trim() }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't rename that location.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="flex items-center gap-1.5">
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleSave}
          className="h-9 w-40 px-3 text-sm"
          disabled={loading}
        />
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "…" : "Save"}
        </Button>
        {error && <span className="text-xs text-status-bad">{error}</span>}
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title={`Rename (${typeLabel})`}
      className="rounded-full border border-border-hairline bg-surface-raised px-3 py-1.5 text-sm text-foreground-muted transition-colors hover:border-foreground-muted hover:text-foreground"
    >
      {name}
    </button>
  );
}
