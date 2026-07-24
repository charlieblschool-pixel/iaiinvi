"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function GenerateInvoiceButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/reports/invoices/generate", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Couldn't generate an invoice.");
      return;
    }
    if (!data.created) {
      setMessage(data.message ?? "Nothing to invoice yet.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="secondary" size="sm" onClick={handleClick} disabled={loading}>
        {loading ? "Generating…" : "Generate last week's invoice"}
      </Button>
      {message && <p className="text-sm text-foreground-muted">{message}</p>}
    </div>
  );
}
