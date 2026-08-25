"use client";

import { useState } from "react";

export function VerifyEmailBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  if (dismissed) return null;

  async function handleResend() {
    setStatus("sending");
    const res = await fetch("/api/auth/resend-verification", { method: "POST" });
    setStatus(res.ok ? "sent" : "idle");
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-status-warn-bg bg-status-warn-bg/60 px-4 py-2.5 text-sm sm:px-8">
      <span className="text-status-warn">
        Verify your email to secure your account.
      </span>
      <div className="flex items-center gap-4">
        {status === "sent" ? (
          <span className="text-status-warn">Verification email sent.</span>
        ) : (
          <button
            onClick={handleResend}
            disabled={status === "sending"}
            className="font-medium text-status-warn underline underline-offset-2 hover:opacity-80 disabled:opacity-50"
          >
            {status === "sending" ? "Sending…" : "Resend email"}
          </button>
        )}
        <button
          onClick={() => setDismissed(true)}
          className="text-status-warn hover:opacity-80"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
