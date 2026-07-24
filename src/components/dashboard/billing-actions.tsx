"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

async function goToUrl(path: string, body?: object) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    alert(data.error ?? "Something went wrong.");
    return;
  }
  window.location.href = data.url;
}

export function UpgradeButton({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        await goToUrl("/api/billing/checkout");
        setLoading(false);
      }}
    >
      {loading ? "Redirecting…" : children}
    </Button>
  );
}

export function ManageBillingButton() {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      variant="secondary"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        await goToUrl("/api/billing/portal");
        setLoading(false);
      }}
    >
      {loading ? "Redirecting…" : "Manage billing"}
    </Button>
  );
}
