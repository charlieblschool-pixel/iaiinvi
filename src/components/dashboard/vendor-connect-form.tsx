"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type VendorConnectionInfo = {
  id: string;
  name: string;
  connected: boolean;
  portalUrl: string | null;
  portalUsername: string | null;
  accountNumber: string | null;
};

export function VendorConnectRow({ vendor }: { vendor: VendorConnectionInfo }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [portalUrl, setPortalUrl] = useState(vendor.portalUrl ?? "");
  const [portalUsername, setPortalUsername] = useState(vendor.portalUsername ?? "");
  const [portalPassword, setPortalPassword] = useState("");
  const [accountNumber, setAccountNumber] = useState(vendor.accountNumber ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/vendors/${vendor.id}/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portalUrl, portalUsername, portalPassword, accountNumber }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't connect that account.");
      return;
    }
    setPortalPassword("");
    setOpen(false);
    router.refresh();
  }

  async function handleDisconnect() {
    setLoading(true);
    await fetch(`/api/vendors/${vendor.id}/connect`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-border-hairline px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">{vendor.name}</span>{" "}
          {vendor.connected ? (
            <Badge tone="good" className="text-[10px]">Connected</Badge>
          ) : (
            <Badge tone="neutral" className="text-[10px]">Not connected</Badge>
          )}
        </div>
        {vendor.connected ? (
          <Button size="sm" variant="secondary" disabled={loading} onClick={handleDisconnect}>
            {loading ? "…" : "Disconnect"}
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setOpen((o) => !o)}>
            {open ? "Cancel" : "Connect"}
          </Button>
        )}
      </div>

      {open && !vendor.connected && (
        <form onSubmit={handleConnect} className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Portal URL</Label>
            <Input
              type="url"
              placeholder="https://orders.example.com"
              value={portalUrl}
              onChange={(e) => setPortalUrl(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Account number</Label>
            <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Username</Label>
            <Input value={portalUsername} onChange={(e) => setPortalUsername(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Password</Label>
            <Input
              type="password"
              value={portalPassword}
              onChange={(e) => setPortalPassword(e.target.value)}
              required
            />
          </div>
          <p className="sm:col-span-2 text-xs text-foreground-muted">
            Stored encrypted, never shown again. Used only to fill this
            vendor&rsquo;s cart when you approve a reorder — you place the
            final order yourself.
          </p>
          {error && <p className="sm:col-span-2 text-sm text-status-bad">{error}</p>}
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "Connecting…" : "Save connection"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
