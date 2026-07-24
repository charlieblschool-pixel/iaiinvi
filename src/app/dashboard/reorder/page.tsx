import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { generateSuggestions, countRecentAutoCharges } from "@/lib/reorder-engine";
import { ReorderSuggestionCard } from "@/components/dashboard/reorder-suggestion-card";
import { Badge } from "@/components/ui/badge";

export default async function ReorderApprovalsPage() {
  const { organization } = await requireOrg();

  await generateSuggestions(organization.id);

  const suggestions = await prisma.reorderSuggestion.findMany({
    where: { organizationId: organization.id, status: "PENDING" },
    include: {
      product: { include: { vendor: true, stockLevels: { include: { location: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const autoChargedToday = await countRecentAutoCharges(organization.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reorder Approvals</h1>
          <p className="mt-1 text-foreground-muted">
            Approve what the engine recommends — or let auto-reorder run it.
          </p>
        </div>
        {autoChargedToday > 0 && (
          <Badge tone="good">
            {autoChargedToday} auto-charged in the last 24h
          </Badge>
        )}
      </div>

      {suggestions.length === 0 ? (
        <div className="rounded-2xl border border-border-hairline bg-surface px-6 py-16 text-center">
          <p className="text-foreground-muted">
            No pending approvals. Suggestions show up here when a product
            without auto-reorder drops to its reorder point.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {suggestions.map((s) => {
            const stockLevel = s.product.stockLevels[0];
            return (
              <ReorderSuggestionCard
                key={s.id}
                id={s.id}
                productName={s.product.name}
                locationName={stockLevel?.location.name ?? "—"}
                onHand={stockLevel?.onHand ?? 0}
                unitLabel={s.product.unitLabel}
                avgWeeklyUsage={s.product.avgWeeklyUsage}
                leadTimeDays={s.product.vendor?.leadTimeDays ?? 7}
                reasoning={s.reasoning}
                quantity={s.quantity}
                totalCost={s.totalCost}
                chargeError={s.chargeError}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
