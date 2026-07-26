import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireInventoryAccess } from "@/lib/session";
import { EditProductForm } from "@/components/dashboard/edit-product-form";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { organization } = await requireInventoryAccess();

  const [product, locations, vendors, categories] = await Promise.all([
    prisma.product.findFirst({
      where: { id, organizationId: organization.id },
      include: { stockLevels: true },
    }),
    prisma.location.findMany({
      where: { organizationId: organization.id },
      orderBy: { name: "asc" },
    }),
    prisma.vendor.findMany({
      where: { organizationId: organization.id },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { organizationId: organization.id },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!product) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold">Edit product</h1>
      <p className="mt-1 text-foreground-muted">
        Update details and stock counts across every location.
      </p>
      <EditProductForm
        product={{
          id: product.id,
          name: product.name,
          unitLabel: product.unitLabel,
          casePackSize: product.casePackSize,
          unitCost: product.unitCost,
          avgWeeklyUsage: product.avgWeeklyUsage,
          vendorId: product.vendorId,
          categoryId: product.categoryId,
        }}
        stockByLocation={Object.fromEntries(
          product.stockLevels.map((s) => [
            s.locationId,
            { onHand: s.onHand, reorderPoint: s.reorderPoint },
          ]),
        )}
        locations={locations}
        vendors={vendors}
        categories={categories}
      />
    </div>
  );
}
