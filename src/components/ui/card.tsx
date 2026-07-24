import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border-hairline bg-surface",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-status-good"
      : tone === "warn"
        ? "text-status-warn"
        : tone === "bad"
          ? "text-status-bad"
          : "text-foreground";

  return (
    <Card className="p-5">
      <div className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
        {label}
      </div>
      <div
        className={cn(
          "mt-2 font-[var(--font-mono)] text-3xl font-semibold tabular-nums",
          toneClass,
        )}
      >
        {value}
      </div>
    </Card>
  );
}
