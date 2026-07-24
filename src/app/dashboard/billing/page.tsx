import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { stripeEnabled, STANDARD_PLAN } from "@/lib/stripe";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UpgradeButton, ManageBillingButton } from "@/components/dashboard/billing-actions";

export default async function BillingPage() {
  const { organization } = await requireOrg();

  const [subscription, recentCharges] = await Promise.all([
    prisma.subscription.findUnique({ where: { organizationId: organization.id } }),
    prisma.activityLogEntry.findMany({
      where: { organizationId: organization.id, type: "AUTO_CHARGED" },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const isActive = subscription?.status === "active" || subscription?.status === "trialing";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="mt-1 text-foreground-muted">
          One flat plan, plus every auto-charged reorder in one place.
        </p>
      </div>

      {!stripeEnabled && (
        <div className="rounded-xl border border-status-warn/40 bg-status-warn-bg px-5 py-4 text-sm text-status-warn">
          Stripe test mode isn&rsquo;t connected yet. Add{" "}
          <code className="font-[var(--font-mono)]">STRIPE_SECRET_KEY</code>{" "}
          to <code className="font-[var(--font-mono)]">.env.local</code> to
          enable checkout and the billing portal.
        </div>
      )}

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
              invii.ai Standard
            </p>
            <p className="mt-1 font-[var(--font-mono)] text-2xl font-semibold">
              ${(STANDARD_PLAN.amountCents / 100).toFixed(0)}
              <span className="text-sm font-normal text-foreground-muted">
                {" "}
                /month
              </span>
            </p>
          </div>
          <Badge tone={isActive ? "good" : "neutral"}>
            {isActive ? "Active" : "No billing on file"}
          </Badge>
        </div>
        <p className="mt-3 text-sm text-foreground-muted">
          Every location, every product, unlimited reorder approvals and
          auto-charges. No tiers to think about.
        </p>
        {subscription?.cardBrand && subscription.cardLast4 && (
          <p className="mt-3 text-sm text-foreground-muted">
            Card on file: {subscription.cardBrand.toUpperCase()} ····{" "}
            {subscription.cardLast4}
          </p>
        )}
        {subscription?.currentPeriodEnd && (
          <p className="mt-1 text-sm text-foreground-muted">
            Renews {subscription.currentPeriodEnd.toLocaleDateString()}
          </p>
        )}
        <div className="mt-5 flex gap-3">
          <UpgradeButton>
            {isActive ? "Update payment method" : "Subscribe — $100/mo"}
          </UpgradeButton>
          {subscription?.stripeCustomerId && <ManageBillingButton />}
        </div>
      </Card>

      <div className="rounded-2xl border border-border-hairline bg-surface">
        <div className="border-b border-border-hairline px-6 py-4">
          <h2 className="font-semibold">Auto-charged reorders</h2>
          <p className="mt-1 text-sm text-foreground-muted">
            Charged to the card on file the moment the reorder engine places
            an order for a product with auto-reorder on.
          </p>
        </div>
        {recentCharges.length === 0 ? (
          <p className="px-6 py-8 text-sm text-foreground-muted">
            Nothing auto-charged yet — enable auto-reorder on a product to
            see charges appear here.
          </p>
        ) : (
          <ul className="divide-y divide-border-hairline">
            {recentCharges.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between px-6 py-3 text-sm"
              >
                <span>{entry.message}</span>
                <span className="text-xs text-foreground-muted">
                  {entry.createdAt.toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
