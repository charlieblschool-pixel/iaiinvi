import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { stockStatus } from "@/lib/inventory";
import { StatTile } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";

export default async function OverviewPage() {
  const { organization } = await requireOrg();

  const [stockLevels, pendingApprovals, recentActivity, vendorCount, productCount, autoReorderCount, subscription] =
    await Promise.all([
      prisma.stockLevel.findMany({
        where: { product: { organizationId: organization.id } },
        include: { product: true, location: true },
      }),
      prisma.reorderSuggestion.count({
        where: { organizationId: organization.id, status: "PENDING" },
      }),
      prisma.activityLogEntry.findMany({
        where: { organizationId: organization.id },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.vendor.count({ where: { organizationId: organization.id } }),
      prisma.product.count({ where: { organizationId: organization.id } }),
      prisma.product.count({ where: { organizationId: organization.id, autoReorder: true } }),
      prisma.subscription.findUnique({ where: { organizationId: organization.id } }),
    ]);

  const onboardingSteps = [
    {
      label: "Add your first vendor and its lead time",
      href: "/dashboard/settings",
      cta: "Add vendor",
      done: vendorCount > 0,
    },
    {
      label: "Add your first product",
      href: "/dashboard/inventory/new",
      cta: "Add product",
      done: productCount > 0,
    },
    {
      label: "Turn on auto-reorder for a product",
      href: "/dashboard/inventory",
      cta: "Go to inventory",
      done: autoReorderCount > 0,
    },
    {
      label: "Add a payment method for auto-charged reorders",
      href: "/dashboard/billing",
      cta: "Go to billing",
      done: subscription?.status === "active" || subscription?.status === "trialing",
    },
  ];

  const inventoryValue = stockLevels.reduce(
    (sum, s) => sum + s.onHand * s.product.unitCost,
    0,
  );

  const withStatus = stockLevels.map((s) => ({
    ...s,
    status: stockStatus(s.onHand, s.reorderPoint),
  }));

  const reorderSoonCount = withStatus.filter(
    (s) => s.status.tone === "warn",
  ).length;
  const outOfStockCount = withStatus.filter(
    (s) => s.status.tone === "bad",
  ).length;

  const needsAttention = withStatus
    .filter((s) => s.status.tone !== "good")
    .sort((a) => (a.status.tone === "bad" ? -1 : 1))
    .slice(0, 8);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="mt-1 text-foreground-muted">
          {organization.name} — your stock at a glance
        </p>
      </div>

      <OnboardingChecklist steps={onboardingSteps} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Inventory value"
          value={`$${inventoryValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        />
        <StatTile
          label="Reorder soon"
          value={reorderSoonCount}
          tone={reorderSoonCount > 0 ? "warn" : undefined}
        />
        <StatTile
          label="Out of stock"
          value={outOfStockCount}
          tone={outOfStockCount > 0 ? "bad" : undefined}
        />
        <StatTile
          label="Pending approvals"
          value={pendingApprovals}
          tone={pendingApprovals > 0 ? "warn" : undefined}
        />
      </div>

      <div className="rounded-2xl border border-border-hairline bg-surface">
        <div className="flex items-center justify-between border-b border-border-hairline px-6 py-4">
          <h2 className="font-semibold">Needs attention</h2>
          <Link
            href="/dashboard/inventory"
            className="text-sm text-brand-light hover:underline"
          >
            View inventory
          </Link>
        </div>
        {needsAttention.length === 0 ? (
          <p className="px-6 py-8 text-sm text-foreground-muted">
            Nothing needs attention right now — every product is above its
            reorder point.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-foreground-muted">
                <th className="px-6 py-3 font-medium">Product</th>
                <th className="px-6 py-3 font-medium">Location</th>
                <th className="px-6 py-3 font-medium">On hand</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {needsAttention.map((s) => (
                <tr key={s.id} className="border-t border-border-hairline">
                  <td className="px-6 py-3">{s.product.name}</td>
                  <td className="px-6 py-3 text-foreground-muted">
                    {s.location.name}
                  </td>
                  <td className="px-6 py-3 text-foreground-muted">
                    {s.onHand} {s.product.unitLabel}
                    {s.onHand === 1 ? "" : "s"}
                  </td>
                  <td className="px-6 py-3">
                    <Badge tone={s.status.tone}>{s.status.label}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-2xl border border-border-hairline bg-surface">
        <div className="flex items-center justify-between border-b border-border-hairline px-6 py-4">
          <h2 className="font-semibold">Recent activity</h2>
          <Link
            href="/dashboard/activity"
            className="text-sm text-brand-light hover:underline"
          >
            View activity log
          </Link>
        </div>
        {recentActivity.length === 0 ? (
          <p className="px-6 py-8 text-sm text-foreground-muted">
            Nothing has happened yet — activity shows up here as stock moves.
          </p>
        ) : (
          <ul className="divide-y divide-border-hairline">
            {recentActivity.map((entry) => (
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
