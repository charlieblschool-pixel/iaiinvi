import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { StatTile, Card } from "@/components/ui/card";
import { ActivityBarChart } from "@/components/dashboard/activity-bar-chart";
import { GenerateInvoiceButton } from "@/components/dashboard/generate-invoice-button";

export default async function ReportsPage() {
  const { organization } = await requireOrg();

  const [products, suggestions, invoices] = await Promise.all([
    prisma.product.findMany({
      where: { organizationId: organization.id },
      include: { stockLevels: true },
    }),
    prisma.reorderSuggestion.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invoice.findMany({
      where: { organizationId: organization.id },
      orderBy: { periodStart: "desc" },
      take: 12,
    }),
  ]);

  const inventoryValue = products.reduce(
    (sum, p) => sum + p.unitCost * p.stockLevels.reduce((s, sl) => s + sl.onHand, 0),
    0,
  );
  const annualUsageValue = products.reduce(
    (sum, p) => sum + p.avgWeeklyUsage * 52 * p.unitCost,
    0,
  );
  const turnoverRate = inventoryValue > 0 ? annualUsageValue / inventoryValue : 0;

  const autoReorderCount = products.filter((p) => p.autoReorder).length;
  const autoReorderCoverage =
    products.length > 0 ? (autoReorderCount / products.length) * 100 : 0;

  const topVelocity = [...products].sort(
    (a, b) => b.avgWeeklyUsage - a.avgWeeklyUsage,
  )[0];

  const autoOrderCount = suggestions.filter(
    (s) => s.status === "AUTO_CHARGED",
  ).length;

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const chartData = days.map((day) => {
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const count = suggestions.filter(
      (s) => s.createdAt >= day && s.createdAt < next,
    ).length;
    return {
      label: day.toLocaleDateString(undefined, { day: "numeric" }),
      value: count,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="mt-1 text-foreground-muted">
          Derived from your actual stock, usage, and reorder data.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Est. turnover rate" value={`${turnoverRate.toFixed(1)}x`} />
        <StatTile
          label="Auto-reorder coverage"
          value={`${autoReorderCoverage.toFixed(0)}%`}
        />
        <StatTile
          label="Highest velocity"
          value={topVelocity ? topVelocity.name : "—"}
        />
        <StatTile label="Auto-orders placed" value={autoOrderCount} />
      </div>

      <Card className="p-6">
        <h2 className="font-semibold">Reorder activity — last 14 days</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          Suggestions created, approved, or auto-charged each day.
        </p>
        <div className="mt-6">
          <ActivityBarChart data={chartData} />
        </div>
      </Card>

      <div className="rounded-2xl border border-border-hairline bg-surface">
        <div className="flex items-center justify-between border-b border-border-hairline px-6 py-4">
          <div>
            <h2 className="font-semibold">Weekly invoices</h2>
            <p className="mt-1 text-sm text-foreground-muted">
              A rollup of every approved and auto-charged reorder, generated
              once per week.
            </p>
          </div>
          <GenerateInvoiceButton />
        </div>
        {invoices.length === 0 ? (
          <p className="px-6 py-8 text-sm text-foreground-muted">
            No invoices yet — one generates automatically once a week has
            passed with at least one approved or auto-charged reorder.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-foreground-muted">
                <th className="px-6 py-3 font-medium">Period</th>
                <th className="px-6 py-3 font-medium">Orders</th>
                <th className="px-6 py-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t border-border-hairline">
                  <td className="px-6 py-3">
                    {inv.periodStart.toLocaleDateString()} –{" "}
                    {inv.periodEnd.toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3 text-foreground-muted">
                    {inv.itemCount}
                  </td>
                  <td className="px-6 py-3 font-[var(--font-mono)]">
                    ${inv.totalAmount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
