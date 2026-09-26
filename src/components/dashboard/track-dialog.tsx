"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { BACKBAR } from "@/lib/categories";
import {
  MOVEMENT_LABELS,
  MOVEMENT_TYPES,
  defaultLocationId,
  searchProducts,
  type MovementKind,
} from "@/lib/tracking";

export type TrackProduct = {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  sku: string | null;
  category: string;
  unitLabel: string;
  stocks: { locationId: string; locationName: string; onHand: number }[];
};

type TrackContext = { open: (productId?: string) => void };
const Ctx = createContext<TrackContext | null>(null);

export function useTrack() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTrack must be used inside <TrackProvider>");
  return ctx;
}

/** Provides the Track dialog to the Inventory page; press T to open it. */
export function TrackProvider({ products, children }: { products: TrackProduct[]; children: React.ReactNode }) {
  const [state, setState] = useState<{ open: boolean; productId?: string; key: number }>({ open: false, key: 0 });
  const open = useCallback(
    (productId?: string) => setState((s) => ({ open: true, productId, key: s.key + 1 })),
    [],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (e.key.toLowerCase() !== "t" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (target.closest("input, textarea, select, [contenteditable=true]")) return;
      e.preventDefault();
      open();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {state.open && (
        <TrackDialog
          key={state.key}
          products={products}
          initialProductId={state.productId}
          onClose={() => setState((s) => ({ ...s, open: false }))}
        />
      )}
    </Ctx.Provider>
  );
}

export function TrackButton() {
  const { open } = useTrack();
  return (
    <Button onClick={() => open()} aria-keyshortcuts="t" title="Track sold, used or wasted (T)">
      Track
    </Button>
  );
}

export function TrackRowButton({ productId, productName }: { productId: string; productName: string }) {
  const { open } = useTrack();
  return (
    <button
      type="button"
      onClick={() => open(productId)}
      aria-label={`Track ${productName}`}
      className="text-sm text-brand-light transition-all duration-150 hover:underline active:scale-95"
    >
      Track
    </button>
  );
}

type Done = {
  movementId: string;
  text: string;
  warning?: string;
  undone?: boolean;
};

function TrackDialog({
  products: initialProducts,
  initialProductId,
  onClose,
}: {
  products: TrackProduct[];
  initialProductId?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [productId, setProductId] = useState<string | null>(initialProductId ?? null);
  const [type, setType] = useState<MovementKind | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Done[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  // Opened from a row's Track button: the product is chosen, so Enter saves.
  useEffect(() => {
    if (initialProductId) submitRef.current?.focus();
  }, [initialProductId]);

  const product = products.find((p) => p.id === productId) ?? null;
  const results = useMemo(() => searchProducts(query, products), [query, products]);
  const effectiveType: MovementKind = type ?? (product?.category === BACKBAR ? "USED" : "SOLD");
  const effectiveLocation = locationId ?? (product ? defaultLocationId(product.stocks) : null);
  const stockHere = product?.stocks.find((s) => s.locationId === effectiveLocation);
  const unit = product?.unitLabel || "unit";

  function choose(id: string) {
    setProductId(id);
    setType(null); // back to the smart default: Retail → Sold, Backbar → Used
    setLocationId(null);
    setQuantity(1);
    setError(null);
    setQuery("");
    requestAnimationFrame(() => submitRef.current?.focus());
  }

  function startOver() {
    setProductId(null);
    setType(null);
    setLocationId(null);
    setQuantity(1);
    setNote("");
    setShowNote(false);
    setError(null);
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && results[highlight]) {
      e.preventDefault();
      choose(results[highlight].id);
    }
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!product || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          type: effectiveType,
          quantity,
          locationId: effectiveLocation,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't save that — please try again.");
        return;
      }
      // Keep the dialog's own counts in step for the next entry.
      if (effectiveLocation && data.newOnHand !== null) {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === product.id
              ? { ...p, stocks: p.stocks.map((s) => (s.locationId === effectiveLocation ? { ...s, onHand: data.newOnHand } : s)) }
              : p,
          ),
        );
      }
      const text = `${quantity} × ${product.name} ${MOVEMENT_LABELS[effectiveType].past}${
        data.locationName ? ` from ${data.locationName} — ${data.newOnHand} left` : ""
      }`;
      setHistory((h) => [
        {
          movementId: data.movementId,
          text,
          warning:
            data.shortBy > 0
              ? `Only ${quantity - data.shortBy} ${quantity - data.shortBy === 1 ? "was" : "were"} counted there, so it's now 0 — worth a recount.`
              : undefined,
        },
        ...h,
      ]);
      router.refresh();
      startOver();
    } catch {
      setError("Couldn't reach invii.ai — check your connection.");
    } finally {
      setSaving(false);
    }
  }

  async function undo(entry: Done) {
    const res = await fetch(`/api/track/${entry.movementId}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setError("Couldn't undo that one — try again from Reports → Sold & wasted.");
      return;
    }
    setHistory((h) => h.map((x) => (x.movementId === entry.movementId ? { ...x, undone: true } : x)));
    // Server has the true numbers — pull them back in.
    router.refresh();
  }

  return (
    <Modal open onClose={onClose} title="Track sold, used or wasted" className="max-w-xl">
      <form onSubmit={submit} className="mt-4 flex flex-col gap-5">
        {!product ? (
          <div className="flex flex-col gap-2">
            <label htmlFor={`${listId}-search`} className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
              Product
            </label>
            <Input
              id={`${listId}-search`}
              ref={searchRef}
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              onKeyDown={onSearchKey}
              placeholder="Type a name, code (P-0012) or scan a barcode"
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls={`${listId}-results`}
              aria-activedescendant={results[highlight] ? `${listId}-opt-${highlight}` : undefined}
              autoComplete="off"
            />
            {query.trim() && (
              <ul
                id={`${listId}-results`}
                role="listbox"
                className="flex max-h-72 flex-col overflow-y-auto rounded-lg border border-border-hairline"
              >
                {results.length === 0 ? (
                  <li className="px-3 py-3 text-sm text-foreground-muted">No product matches &ldquo;{query}&rdquo;.</li>
                ) : (
                  results.map((p, i) => {
                    const total = p.stocks.reduce((s, x) => s + x.onHand, 0);
                    return (
                      <li
                        key={p.id}
                        id={`${listId}-opt-${i}`}
                        role="option"
                        aria-selected={i === highlight}
                        onMouseEnter={() => setHighlight(i)}
                        onClick={() => choose(p.id)}
                        className={cn(
                          "flex cursor-pointer items-center justify-between gap-3 border-b border-border-hairline px-3 py-2.5 text-sm last:border-0",
                          i === highlight ? "bg-brand/10" : "hover:bg-surface-raised",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate">{p.name}</span>
                          <span className="text-xs text-foreground-muted">
                            {[p.brand, p.category].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block font-mono text-xs text-foreground-muted">{p.code}</span>
                          <span className="text-xs text-foreground-muted">{total} on hand</span>
                        </span>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 rounded-lg border border-border-hairline bg-surface-raised px-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="font-mono">{product.code}</Badge>
                  <span className="text-xs text-foreground-muted">{product.category}</span>
                </div>
                <p className="mt-1 truncate font-medium">{product.name}</p>
                {product.brand && <p className="text-xs text-foreground-muted">{product.brand}</p>}
              </div>
              <button type="button" onClick={startOver} className="shrink-0 text-sm text-brand-light hover:underline">
                Change
              </button>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground-muted">What happened</legend>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="What happened">
                {MOVEMENT_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={effectiveType === t}
                    aria-label={`${MOVEMENT_LABELS[t].label} — ${MOVEMENT_LABELS[t].hint}`}
                    onClick={() => setType(t)}
                    className={cn(
                      "flex flex-col items-start rounded-lg border px-3 py-2.5 text-left transition-all duration-150 active:scale-[0.97]",
                      effectiveType === t
                        ? t === "WASTED"
                          ? "border-status-bad/60 bg-status-bad-bg text-status-bad"
                          : "border-brand bg-brand/10 text-brand-light"
                        : "border-border-hairline text-foreground-muted hover:border-white/40 hover:text-foreground",
                    )}
                  >
                    <span className="text-sm font-semibold">{MOVEMENT_LABELS[t].label}</span>
                    <span className="text-[11px] leading-tight opacity-80">{MOVEMENT_LABELS[t].hint}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-wrap items-end gap-5">
              <div className="flex flex-col gap-2">
                <label htmlFor={`${listId}-qty`} className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
                  How many
                </label>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="secondary" size="sm" className="h-11 w-11" aria-label="One less" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                    −
                  </Button>
                  <Input
                    id={`${listId}-qty`}
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                    className="w-20 text-center"
                  />
                  <Button type="button" variant="secondary" size="sm" className="h-11 w-11" aria-label="One more" onClick={() => setQuantity((q) => q + 1)}>
                    +
                  </Button>
                </div>
              </div>

              {product.stocks.length > 1 && (
                <fieldset className="flex min-w-0 flex-1 flex-col gap-2">
                  <legend className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground-muted">Taken from</legend>
                  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Taken from">
                    {product.stocks.map((s) => (
                      <button
                        key={s.locationId}
                        type="button"
                        role="radio"
                        aria-checked={effectiveLocation === s.locationId}
                        aria-label={`${s.locationName}, ${s.onHand} on hand`}
                        onClick={() => setLocationId(s.locationId)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150 active:scale-95",
                          effectiveLocation === s.locationId
                            ? "border-brand bg-brand/10 text-brand-light"
                            : "border-border-hairline text-foreground-muted hover:border-white/40 hover:text-foreground",
                        )}
                      >
                        {s.locationName} <span className="tabular-nums opacity-70">{s.onHand}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
            </div>

            <p className="text-xs text-foreground-muted">
              {stockHere
                ? `${stockHere.locationName}: ${stockHere.onHand} → ${Math.max(0, stockHere.onHand - quantity)} ${unit}${stockHere.onHand - quantity === 1 ? "" : "s"}${
                    quantity > stockHere.onHand ? " (more than was counted — it'll go to 0)" : ""
                  }`
                : "Not stocked in any location yet — this is recorded for reports, stock doesn't change."}
            </p>

            {showNote ? (
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional) — e.g. dropped bottle" maxLength={300} />
            ) : (
              <button type="button" onClick={() => setShowNote(true)} className="w-fit text-xs text-foreground-muted hover:text-foreground hover:underline">
                + Add a note
              </button>
            )}

            <Button ref={submitRef} type="submit" disabled={saving} className="h-12">
              {saving ? "Saving…" : `Track ${quantity} ${MOVEMENT_LABELS[effectiveType].past}`}
            </Button>
          </>
        )}

        {error && <p className="text-sm text-status-bad" role="alert">{error}</p>}

        {history.length > 0 && (
          <div className="border-t border-border-hairline pt-4" aria-live="polite">
            <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">Tracked just now</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {history.map((h) => (
                <li key={h.movementId} className="animate-page-in flex items-start justify-between gap-3 text-sm">
                  <span className={cn(h.undone && "text-foreground-muted line-through")}>
                    <span className="text-status-good" aria-hidden>✓ </span>
                    {h.text}
                    {h.warning && !h.undone && <span className="block text-xs text-status-warn">{h.warning}</span>}
                  </span>
                  {!h.undone && (
                    <button type="button" onClick={() => undo(h)} className="shrink-0 text-xs text-brand-light hover:underline">
                      Undo
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </Modal>
  );
}
