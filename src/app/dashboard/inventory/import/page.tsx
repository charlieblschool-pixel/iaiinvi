import { prisma } from "@/lib/prisma";
import { requireInventoryAccess } from "@/lib/session";
import { ImportForm } from "@/components/dashboard/import-form";
import { LOCATION_ORDER } from "@/lib/locations";

export default async function ImportInventoryPage() {
  const { organization } = await requireInventoryAccess();

  const [locations, products] = await Promise.all([
    prisma.location.findMany({
      where: { organizationId: organization.id },
      orderBy: LOCATION_ORDER,
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { organizationId: organization.id },
      select: { id: true, code: true, name: true, sku: true, category: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold">Import spreadsheet</h1>
      <p className="mt-1 text-foreground-muted">
        Bring in your inventory or a fresh recount. We sort every product into Backbar or Retail and
        into the locations from your sheet — you review everything before it&rsquo;s saved.
      </p>
      <div className="mt-8">
        <ImportForm
          locations={locations}
          products={products.map((p) => ({
            id: p.id,
            code: p.code,
            name: p.name,
            sku: p.sku,
            categoryName: p.category?.name ?? null,
          }))}
        />
      </div>
    </div>
  );
}
