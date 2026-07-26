import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireInventoryAccess } from "@/lib/session";
import { LinkButton } from "@/components/ui/button";
import {
  InventoryBoard,
  type BoardLocation,
  type BoardProduct,
} from "@/components/dashboard/inventory-board";

export default async function InventoryPage() {
  const { organization } = await requireInventoryAccess();

  const locations = await prisma.location.findMany({
    where: { organizationId: organization.id },
    orderBy: { name: "asc" },
  });

  const products = await prisma.product.findMany({
    where: { organizationId: organization.id },
    include: {
      category: true,
      stockLevels: true,
    },
    orderBy: { name: "asc" },
  });

  const productsWithStock = products.filter((p) => p.stockLevels.length > 0);
  const locationsWithStock = locations.filter((l) =>
    productsWithStock.some((p) => p.stockLevels.some((s) => s.locationId === l.id)),
  );

  const boardLocations: BoardLocation[] = locationsWithStock.map((l) => ({
    id: l.id,
    name: l.name,
  }));

  const brandMap = new Map<string, BoardProduct[]>();
  for (const product of productsWithStock) {
    const brand = product.category?.name ?? "Uncategorized";
    const boardProduct: BoardProduct = {
      id: product.id,
      name: product.name,
      unitLabel: product.unitLabel,
      autoReorder: product.autoReorder,
      brand,
      stock: product.stockLevels.map((s) => ({
        locationId: s.locationId,
        onHand: s.onHand,
        reorderPoint: s.reorderPoint,
      })),
    };
    if (!brandMap.has(brand)) brandMap.set(brand, []);
    brandMap.get(brand)!.push(boardProduct);
  }

  const brands = Array.from(brandMap.entries())
    .map(([name, products]) => ({ name, products }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Inventory</h1>
          <p className="mt-1 text-foreground-muted">
            {products.length} product{products.length === 1 ? "" : "s"} ·{" "}
            {locations.length} locations
          </p>
        </div>
        <div className="flex gap-3">
          <LinkButton href="/dashboard/inventory/import-sales" variant="secondary">
            Sync Booker sales
          </LinkButton>
          <LinkButton href="/dashboard/inventory/import" variant="secondary">
            Import spreadsheet
          </LinkButton>
          <LinkButton href="/dashboard/inventory/new">+ Add product</LinkButton>
        </div>
      </div>

      {brands.length === 0 ? (
        <div className="rounded-2xl border border-border-hairline bg-surface px-6 py-16 text-center">
          <p className="text-foreground-muted">
            No products yet. Add your first one, or import your existing
            spreadsheet to start tracking stock in minutes.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <LinkButton href="/dashboard/inventory/import" variant="secondary">
              Import spreadsheet
            </LinkButton>
            <LinkButton href="/dashboard/inventory/new">+ Add product</LinkButton>
          </div>
        </div>
      ) : (
        <InventoryBoard locations={boardLocations} brands={brands} />
      )}

      <p className="text-sm text-foreground-muted">
        Locations without stock yet aren&rsquo;t shown.{" "}
        <Link href="/dashboard/settings" className="text-brand-light hover:underline">
          Manage locations in Settings
        </Link>
        .
      </p>
    </div>
  );
}
