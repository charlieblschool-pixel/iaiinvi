"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EXAMPLE_LOCATIONS } from "@/lib/locations";

type ManagedLocation = { id: string; name: string; productCount: number };

export function LocationManager({
  locations,
  canDelete,
}: {
  locations: ManagedLocation[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(url: string, method: string, body?: unknown) {
    setError(null);
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    if (!res) {
      setError("Couldn't reach invii.ai — check your connection.");
      return false;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    if (await send("/api/locations", "POST", { name: newName })) setNewName("");
    setAdding(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {locations.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-hairline px-4 py-6 text-center text-sm text-foreground-muted">
          No locations yet. Add the places you keep product — like{" "}
          {EXAMPLE_LOCATIONS.join(", ")} — or import a spreadsheet and they&rsquo;ll be created
          for you.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border-hairline rounded-lg border border-border-hairline">
          {locations.map((location, i) => (
            <LocationRow
              key={location.id}
              location={location}
              isFirst={i === 0}
              isLast={i === locations.length - 1}
              canDelete={canDelete}
              send={send}
            />
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New location, e.g. Retail Drawer"
          maxLength={60}
        />
        <Button type="submit" disabled={adding || !newName.trim()}>
          {adding ? "Adding…" : "Add"}
        </Button>
      </form>
      {error && <p className="text-sm text-status-bad">{error}</p>}
    </div>
  );
}

function LocationRow({
  location,
  isFirst,
  isLast,
  canDelete,
  send,
}: {
  location: ManagedLocation;
  isFirst: boolean;
  isLast: boolean;
  canDelete: boolean;
  send: (url: string, method: string, body?: unknown) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(location.name);
  const [busy, setBusy] = useState(false);
  const url = `/api/locations/${location.id}`;

  async function run(action: () => Promise<boolean>) {
    setBusy(true);
    const ok = await action();
    setBusy(false);
    return ok;
  }

  async function handleRename(e?: React.FormEvent) {
    e?.preventDefault();
    if (!value.trim() || value.trim() === location.name) {
      setEditing(false);
      setValue(location.name);
      return;
    }
    if (await run(() => send(url, "PATCH", { name: value }))) setEditing(false);
  }

  async function handleDelete() {
    const warning =
      location.productCount > 0
        ? `Delete "${location.name}"? Stock counts for ${location.productCount} product${location.productCount === 1 ? "" : "s"} here will be removed (the products stay).`
        : `Delete "${location.name}"?`;
    if (!confirm(warning)) return;
    await run(() => send(url, "DELETE"));
  }

  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2">
      <div className="flex flex-col">
        <button
          type="button"
          aria-label={`Move ${location.name} up`}
          disabled={isFirst || busy}
          onClick={() => run(() => send(url, "PATCH", { move: "up" }))}
          className="px-1 text-xs leading-none text-foreground-muted hover:text-foreground disabled:opacity-25"
        >
          ▲
        </button>
        <button
          type="button"
          aria-label={`Move ${location.name} down`}
          disabled={isLast || busy}
          onClick={() => run(() => send(url, "PATCH", { move: "down" }))}
          className="px-1 text-xs leading-none text-foreground-muted hover:text-foreground disabled:opacity-25"
        >
          ▼
        </button>
      </div>

      {editing ? (
        <form onSubmit={handleRename} className="flex flex-1 items-center gap-2">
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setEditing(false);
                setValue(location.name);
              }
            }}
            maxLength={60}
            className="h-9"
            disabled={busy}
          />
          <Button type="submit" size="sm" disabled={busy}>
            Save
          </Button>
        </form>
      ) : (
        <>
          <span className="flex-1 text-sm">{location.name}</span>
          <span className="text-xs text-foreground-muted">
            {location.productCount} product{location.productCount === 1 ? "" : "s"}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} disabled={busy}>
            Rename
          </Button>
          {canDelete && (
            <Button variant="ghost" size="sm" onClick={handleDelete} disabled={busy}>
              Delete
            </Button>
          )}
        </>
      )}
    </li>
  );
}
