"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Toggle } from "@/components/ui/toggle";

export function AutoReorderToggle({
  productId,
  productName,
  initialValue,
}: {
  productId: string;
  productName: string;
  initialValue: boolean;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(initialValue);
  const [, startTransition] = useTransition();

  async function handleChange(next: boolean) {
    setChecked(next);
    const res = await fetch(`/api/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoReorder: next }),
    });
    if (!res.ok) {
      setChecked(!next);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <Toggle
      checked={checked}
      onChange={handleChange}
      label={`Auto-reorder for ${productName}`}
    />
  );
}
