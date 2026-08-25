"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!email || !token) {
    return (
      <Card className="p-8 text-center">
        <h1 className="text-xl font-semibold">Invalid reset link</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          This password reset link is missing information. Request a new one.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 inline-block text-sm text-brand-light hover:underline"
        >
          Request a new link
        </Link>
      </Card>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, token, password }),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't reset your password. The link may have expired.");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  if (done) {
    return (
      <Card className="p-8 text-center">
        <h1 className="text-xl font-semibold">Password updated</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          Redirecting you to log in…
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-8">
      <h1 className="text-xl font-semibold">Set a new password</h1>
      <p className="mt-1 text-sm text-foreground-muted">
        Choose a new password for {email}.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>
        {error && <p className="text-sm text-status-bad">{error}</p>}
        <Button type="submit" disabled={loading} className="mt-2 w-full">
          {loading ? "Saving…" : "Reset password"}
        </Button>
      </form>
    </Card>
  );
}

export function ResetPasswordFormWithSuspense() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
