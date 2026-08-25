"use client";

import { useEffect } from "react";
import { Button, LinkButton } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-wider text-brand-light">
        Error
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        Something went wrong.
      </h1>
      <p className="mt-4 max-w-md text-foreground-muted">
        Our team has been notified. Try again, or head back to the homepage.
      </p>
      <div className="mt-8 flex gap-3">
        <Button onClick={() => reset()}>Try again</Button>
        <LinkButton href="/" variant="secondary">
          Back to home
        </LinkButton>
      </div>
    </main>
  );
}
