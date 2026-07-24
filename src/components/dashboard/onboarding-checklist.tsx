import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

type Step = { label: string; href: string; done: boolean; cta: string };

export function OnboardingChecklist({ steps }: { steps: Step[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  return (
    <Card className="border-brand/40 p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Getting started</h2>
        <span className="text-sm text-foreground-muted">
          {doneCount} of {steps.length} done
        </span>
      </div>
      <ul className="mt-4 flex flex-col gap-3">
        {steps.map((step) => (
          <li key={step.label} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs",
                  step.done
                    ? "border-status-good bg-status-good-bg text-status-good"
                    : "border-border-hairline text-foreground-muted",
                )}
              >
                {step.done ? "✓" : ""}
              </span>
              <span className={step.done ? "text-foreground-muted line-through" : ""}>
                {step.label}
              </span>
            </div>
            {!step.done && (
              <Link href={step.href} className="text-sm text-brand-light hover:underline">
                {step.cta}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
