import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { LOCATION_ORDER } from "@/lib/locations";
import { usageCategoryFromName } from "@/lib/categories";
import { ReorderList } from "@/components/dashboard/reorder-list";

export const metadata = { title: "Reorder list — invii.ai" };

export default async function ReorderListPage() {
  const { organization } = await requireOrg();

  const [products, locations] = await Promise.all([
    prisma.product.findMany({
      where: { organizationId: organization.id },
      include: { vendor: true, category: true, stockLevels: true },
      orderBy: { name: "asc" },
    }),
    prisma.location.findMany({ where: { organizationId: organization.id }, orderBy: LOCATION_ORDER }),
  ]);
  const locationName = new Map(locations.map((l) => [l.id, l.name]));
  const locationRank = new Map(locations.map((l, i) => [l.id, i]));

  return (
    <ReorderList
      products={products.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        brand: p.brand,
        category: usageCategoryFromName(p.category?.name) ?? p.category?.name ?? null,
        unitLabel: p.unitLabel,
        casePackSize: p.casePackSize,
        unitCost: p.unitCost,
        avgWeeklyUsage: p.avgWeeklyUsage,
        vendor: p.vendor ? { name: p.vendor.name, leadTimeDays: p.vendor.leadTimeDays } : null,
        stocks: [...p.stockLevels]
          .sort((a, b) => (locationRank.get(a.locationId) ?? 0) - (locationRank.get(b.locationId) ?? 0))
          .map((s) => ({
            locationName: locationName.get(s.locationId) ?? "—",
            onHand: s.onHand,
            reorderPoint: s.reorderPoint,
          })),
      }))}
    />
  );
}
