import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { stripeEnabled, STANDARD_PLAN } from "@/lib/stripe";
import { hasInventoryAccess, isTrialActive, trialDaysLeft } from "@/lib/billing";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UpgradeButton, ManageBillingButton } from "@/components/dashboard/billing-actions";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ paywall?: string }>;
}) {
  const { organization } = await requireOrg();
  const { paywall } = await searchParams;

  const [subscription, recentCharges] = await Promise.all([
    prisma.subscription.findUnique({ where: { organizationId: organization.id } }),
    prisma.activityLogEntry.findMany({
      where: { organizationId: organization.id, type: "AUTO_CHARGED" },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const isActive = subscription?.status === "active";
  const trialing = isTrialActive(subscription);
  const trialExpired =
    subscription?.status === "trialing" && !trialing && Boolean(subscription.trialEndsAt);
  const daysLeft = trialDaysLeft(subscription);
  const hasAccess = hasInventoryAccess(subscription);

  let badgeTone: "good" | "warn" | "bad" | "neutral" = "neutral";
  let badgeLabel = "No billing on file";
  if (isActive) {
    badgeTone = "good";
    badgeLabel = "Active";
  } else if (trialing) {
    badgeTone = "warn";
    badgeLabel = `Trial — ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
  } else if (trialExpired) {
    badgeTone = "bad";
    badgeLabel = "Trial expired";
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="mt-1 text-foreground-muted">
          One flat plan, plus every auto-charged reorder in one place.
        </p>
      </div>

      {paywall === "inventory" && !hasAccess && (
        <div className="rounded-xl border border-status-bad/40 bg-status-bad-bg px-5 py-4 text-sm text-status-bad">
          Your 14-day free trial has ended — subscribe below to keep using
          Inventory.
        </div>
      )}

      {trialing && (
        <div className="rounded-xl border border-status-warn/40 bg-status-warn-bg px-5 py-4 text-sm text-status-warn">
          You&rsquo;re on your 14-day free trial with {daysLeft} day
          {daysLeft === 1 ? "" : "s"} left. Subscribe now and your card won&rsquo;t
          be charged until the trial ends.
        </div>
      )}

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
          <Badge tone={badgeTone}>{badgeLabel}</Badge>
        </div>
        <p className="mt-3 text-sm text-foreground-muted">
          Every location, every product, unlimited reorder approvals and
          auto-charges. 14 days free, then $100/mo — cancel anytime.
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
            {isActive
              ? "Update payment method"
              : subscription?.stripeCustomerId
                ? "Reactivate — $100/mo"
                : "Subscribe — $100/mo"}
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
