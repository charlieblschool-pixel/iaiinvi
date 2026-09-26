"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Undo a tracked entry from the report: removes it and puts the stock back. */
export function UndoMovementButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function undo() {
    if (!confirm(`Undo "${label}"? The stock goes back to where it came from.`)) return;
    setBusy(true);
    setError(false);
    const res = await fetch(`/api/track/${id}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError(true);
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={undo}
      disabled={busy}
      className="shrink-0 text-xs text-foreground-muted transition-all duration-150 hover:text-foreground hover:underline active:scale-95 disabled:opacity-50 print:hidden"
    >
      {busy ? "Undoing…" : error ? "Couldn't undo — retry" : "Undo"}
    </button>
  );
}
