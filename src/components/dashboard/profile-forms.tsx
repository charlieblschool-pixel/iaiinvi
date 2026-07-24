"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ProfileNameForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    const res = await fetch("/api/profile", {
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
      <h2 className="font-semibold">Your name</h2>
      <form onSubmit={handleSubmit} className="mt-4 flex items-end gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="profileName">Name</Label>
          <Input
            id="profileName"
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

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  if (!hasPassword) {
    return (
      <Card className="p-6">
        <h2 className="font-semibold">Password</h2>
        <p className="mt-2 text-sm text-foreground-muted">
          You sign in with Google — there&rsquo;s no password to change here.
        </p>
      </Card>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("saving");
    const res = await fetch("/api/profile/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Couldn't update your password.");
      setStatus("idle");
      return;
    }
    setStatus("saved");
    setCurrentPassword("");
    setNewPassword("");
    setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <Card className="p-6">
      <h2 className="font-semibold">Password</h2>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
        </div>
        {error && <p className="text-sm text-status-bad">{error}</p>}
        <div>
          <Button type="submit" disabled={status === "saving"}>
            {status === "saved"
              ? "Password updated"
              : status === "saving"
                ? "Updating…"
                : "Update password"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
