"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, businessName, email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong. Try again.");
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);

    if (result?.error) {
      setError("Account created — log in to continue.");
      router.push("/login");
      return;
    }

    router.push("/dashboard/overview");
  }

  return (
    <Card className="p-8">
      <h1 className="text-xl font-semibold">Create your workspace</h1>
      <p className="mt-1 text-sm text-foreground-muted">
        Set up invii.ai for your business in under a minute.
      </p>

      <button
        type="button"
        onClick={() => signIn("google", { callbackUrl: "/dashboard/overview" })}
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
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jordan Lee"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="businessName">Business name</Label>
          <Input
            id="businessName"
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Riverside Barber Co."
          />
        </div>
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
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>
        {error && <p className="text-sm text-status-bad">{error}</p>}
        <Button type="submit" disabled={loading} className="mt-2 w-full">
          {loading ? "Creating workspace…" : "Create workspace"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-foreground-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-light hover:underline">
          Log in
        </Link>
      </p>
    </Card>
  );
}
