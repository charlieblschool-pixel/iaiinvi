import { requireOrg } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";

export const metadata = { title: "Reorder Approvals — invii.ai" };

export default async function ReorderApprovalsPage() {
  await requireOrg();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Reorder Approvals</h1>
          <Badge tone="warn">Coming soon</Badge>
        </div>
        <p className="mt-1 text-foreground-muted">
          One-tap approvals that place the order with your vendor for you.
        </p>
      </div>

      <Card className="px-6 py-14 text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-brand-light">Coming soon</p>
        <h2 className="mx-auto mt-3 max-w-lg text-xl font-semibold">
          Approving and placing orders from invii.ai is on its way
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-foreground-muted">
          Soon you&rsquo;ll be able to approve a suggestion and have the order sent to your vendor
          automatically. Until then, the Reorder list shows exactly what to order, how many, and why —
          ready to print or download for your next vendor order.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <LinkButton href="/dashboard/reports/reorder">Open the Reorder list</LinkButton>
          <LinkButton href="/dashboard/inventory" variant="secondary">
            Go to inventory
          </LinkButton>
        </div>
      </Card>
    </div>
  );
}
