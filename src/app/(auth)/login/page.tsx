"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard/overview";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("That email and password don't match an account.");
      return;
    }
    router.push(callbackUrl);
  }

  return (
    <Card className="p-8">
      <h1 className="text-xl font-semibold">Log in</h1>
      <p className="mt-1 text-sm text-foreground-muted">
        Welcome back — pick up where you left off.
      </p>

      <button
        type="button"
        onClick={() => signIn("google", { callbackUrl })}
        className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border-hairline bg-surface-raised text-sm font-medium transition-colors hover:border-foreground-muted"
      >
        Continue with Google
      </button>

      <div className="my-6 flex items-center gap-3 text-xs text-foreground-muted">
        <div className="h-px flex-1 bg-border-hairline" />
        or
        <div className="h-px flex-1 bg-border-hairline" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@business.com"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        {error && <p className="text-sm text-status-bad">{error}</p>}
        <Button type="submit" disabled={loading} className="mt-2 w-full">
          {loading ? "Logging in…" : "Log in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-foreground-muted">
        New to invii.ai?{" "}
        <Link href="/signup" className="text-brand-light hover:underline">
          Create an account
        </Link>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
