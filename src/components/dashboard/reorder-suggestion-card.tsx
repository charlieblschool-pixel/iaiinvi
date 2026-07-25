"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ReorderSuggestionCard({
  id,
  productName,
  locationName,
  onHand,
  unitLabel,
  avgWeeklyUsage,
  leadTimeDays,
  reasoning,
  quantity,
  totalCost,
  chargeError,
}: {
  id: string;
  productName: string;
  locationName: string;
  onHand: number;
  unitLabel: string;
  avgWeeklyUsage: number;
  leadTimeDays: number;
  reasoning: string;
  quantity: number;
  totalCost: number;
  chargeError?: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"approve" | "skip" | null>(null);
  const [vendorOrder, setVendorOrder] = useState<{ status: string; message: string; reviewUrl?: string } | null>(null);
  const [, startTransition] = useTransition();

  async function handleAction(action: "approve" | "skip") {
    setPending(action);
    const res = await fetch(`/api/reorder/${id}/${action}`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setPending(null);
    if (res.ok) {
      if (action === "approve" && data.vendorOrder) {
        setVendorOrder(data.vendorOrder);
        return;
      }
      startTransition(() => router.refresh());
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
            {locationName}
          </p>
          <h3 className="mt-1 text-lg font-semibold">{productName}</h3>
        </div>
        <Badge tone="warn">Reorder Soon</Badge>
      </div>

      <p className="mt-2 text-sm text-foreground-muted">
        {onHand} {unitLabel}
        {onHand === 1 ? "" : "s"} left · avg {avgWeeklyUsage}/wk · vendor lead
        time {leadTimeDays} days
      </p>

      {vendorOrder && (
        <div className="mt-3 rounded-lg bg-status-good-bg px-3 py-2 text-sm text-status-good">
          {vendorOrder.message}
          {vendorOrder.status === "ready_for_review" && vendorOrder.reviewUrl && (
            <>
              {" "}
              <a href={vendorOrder.reviewUrl} target="_blank" rel="noreferrer" className="underline">
                Review &amp; place order
              </a>
            </>
          )}
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => startTransition(() => router.refresh())}
          >
            Dismiss
          </button>
        </div>
      )}

      {chargeError && (
        <p className="mt-3 rounded-lg bg-status-warn-bg px-3 py-2 text-sm text-status-warn">
          Auto-reorder is on for this product, but it couldn&rsquo;t be
          charged automatically: {chargeError}. Approve manually below, or
          fix billing in Settings.
        </p>
      )}

      <div className="mt-4 rounded-xl border-l-2 border-brand bg-surface-raised p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-brand-light">
          <span className="h-2 w-2 rounded-full bg-brand-light" />
          Reorder engine
        </div>
        <p className="mt-1.5 text-sm text-foreground">{reasoning}</p>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-foreground-muted">
            Suggested
          </p>
          <p className="font-[var(--font-mono)] text-xl font-semibold tabular-nums">
            Order {quantity} {unitLabel}
            {quantity === 1 ? "" : "s"} · ${totalCost.toFixed(2)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={pending !== null}
            onClick={() => handleAction("skip")}
          >
            {pending === "skip" ? "Skipping…" : "Skip"}
          </Button>
          <Button
            size="sm"
            disabled={pending !== null}
            onClick={() => handleAction("approve")}
          >
            {pending === "approve" ? "Approving…" : "Approve"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
