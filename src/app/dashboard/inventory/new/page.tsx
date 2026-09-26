import { prisma } from "@/lib/prisma";
import { LOCATION_ORDER, stockedFirst } from "@/lib/locations";
import { requireInventoryAccess } from "@/lib/session";
import { NewProductForm } from "@/components/dashboard/new-product-form";

export default async function NewProductPage() {
  const { organization } = await requireInventoryAccess();

  const [locations, vendors, categories, stock] = await Promise.all([
    prisma.location.findMany({
      where: { organizationId: organization.id },
      orderBy: LOCATION_ORDER,
      select: { id: true, name: true },
    }),
    prisma.vendor.findMany({
      where: { organizationId: organization.id },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { organizationId: organization.id },
      orderBy: { name: "asc" },
    }),
    prisma.stockLevel.groupBy({
      by: ["locationId"],
      where: { location: { organizationId: organization.id } },
      _sum: { onHand: true },
    }),
  ]);
  const unitsByLocation = new Map(stock.map((s) => [s.locationId, s._sum.onHand ?? 0]));

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold">Add product</h1>
      <p className="mt-1 text-foreground-muted">
        Set where it lives and how many you have — you can add more locations
        later from the edit screen.
      </p>
      <NewProductForm locations={stockedFirst(locations, unitsByLocation)} vendors={vendors} categories={categories} />
    </div>
  );
}
