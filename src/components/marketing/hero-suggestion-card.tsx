import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function HeroSuggestionCard() {
  return (
    <Card className="w-full max-w-md p-6 shadow-[0_0_80px_-20px_var(--brand)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
            Reorder queue · Backbar
          </p>
          <h3 className="mt-1 text-lg font-semibold">Pomade — Matte Finish</h3>
        </div>
        <Badge tone="warn">Reorder Soon</Badge>
      </div>

      <p className="mt-2 text-sm text-foreground-muted">
        6 jars left · avg 8/wk · vendor lead time 5 days
      </p>

      <div className="mt-4 rounded-xl border-l-2 border-brand bg-surface-raised p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-brand-light">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-light opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-light" />
          </span>
          Reorder engine
        </div>
        <p className="mt-1.5 text-sm text-foreground">
          Usage is accelerating — you&rsquo;ll hit zero 2 days before the next
          restock lands. Rounded up to a full case.
        </p>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-foreground-muted">
            Suggested
          </p>
          <p className="font-[var(--font-mono)] text-xl font-semibold tabular-nums">
            Order 12 jars · $84.00
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary">
            Skip
          </Button>
          <Button size="sm">Approve</Button>
        </div>
      </div>
    </Card>
  );
}
