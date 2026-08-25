"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";

type Status = "loading" | "success" | "error";

function VerifyEmailStatus() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<Status>(email && token ? "loading" : "error");

  useEffect(() => {
    if (!email || !token) return;
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, token }),
    })
      .then((res) => setStatus(res.ok ? "success" : "error"))
      .catch(() => setStatus("error"));
  }, [email, token]);

  return (
    <Card className="p-8 text-center">
      {status === "loading" && (
        <>
          <h1 className="text-xl font-semibold">Verifying…</h1>
          <p className="mt-2 text-sm text-foreground-muted">
            One moment while we confirm your email.
          </p>
        </>
      )}
      {status === "success" && (
        <>
          <h1 className="text-xl font-semibold">Email verified</h1>
          <p className="mt-2 text-sm text-foreground-muted">
            Thanks — your email is confirmed.
          </p>
          <LinkButton href="/dashboard/overview" className="mt-6">
            Go to dashboard
          </LinkButton>
        </>
      )}
      {status === "error" && (
        <>
          <h1 className="text-xl font-semibold">Link expired or invalid</h1>
          <p className="mt-2 text-sm text-foreground-muted">
            This verification link isn&rsquo;t valid anymore. You can request
            a new one from your dashboard.
          </p>
          <LinkButton href="/dashboard/overview" variant="secondary" className="mt-6">
            Go to dashboard
          </LinkButton>
        </>
      )}
    </Card>
  );
}

export function VerifyEmailStatusWithSuspense() {
  return (
    <Suspense>
      <VerifyEmailStatus />
    </Suspense>
  );
}
