import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireInventoryAccess } from "@/lib/session";
import { LinkButton } from "@/components/ui/button";
import { LOCATION_ORDER, stockedFirst } from "@/lib/locations";
import { USAGE_CATEGORIES, usageCategoryFromName } from "@/lib/categories";
import {
  InventoryBoard,
  type BoardGroup,
  type BoardLocation,
  type BoardProduct,
} from "@/components/dashboard/inventory-board";

const UNCATEGORIZED = "Needs a category";

export default async function InventoryPage() {
  const { organization } = await requireInventoryAccess();

  const [locations, products] = await Promise.all([
    prisma.location.findMany({
      where: { organizationId: organization.id },
      orderBy: LOCATION_ORDER,
    }),
    prisma.product.findMany({
      where: { organizationId: organization.id },
      include: { category: true, stockLevels: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Locations holding stock first, then ones with only zero counts; never-used
  // locations are left off the table (they're still in Settings).
  const unitsByLocation = new Map<string, number>();
  const usedLocationIds = new Set<string>();
  for (const p of products) {
    for (const s of p.stockLevels) {
      usedLocationIds.add(s.locationId);
      unitsByLocation.set(s.locationId, (unitsByLocation.get(s.locationId) ?? 0) + s.onHand);
    }
  }
  const locationsWithStock = stockedFirst(
    locations.filter((l) => usedLocationIds.has(l.id)),
    unitsByLocation,
  );
  const boardLocations: BoardLocation[] = locationsWithStock.map((l) => ({ id: l.id, name: l.name }));

  const groupMap = new Map<string, BoardProduct[]>();
  for (const product of products) {
    const category =
      usageCategoryFromName(product.category?.name) ?? product.category?.name ?? UNCATEGORIZED;
    const boardProduct: BoardProduct = {
      id: product.id,
      code: product.code,
      name: product.name,
      brand: product.brand,
      sku: product.sku,
      unitLabel: product.unitLabel,
      autoReorder: product.autoReorder,
      category,
      stock: product.stockLevels.map((s) => ({
        locationId: s.locationId,
        onHand: s.onHand,
        reorderPoint: s.reorderPoint,
      })),
    };
    if (!groupMap.has(category)) groupMap.set(category, []);
    groupMap.get(category)!.push(boardProduct);
  }

  // Backbar, Retail, then any custom categories, with "needs a category" last.
  const rank = (name: string) => {
    const builtIn = USAGE_CATEGORIES.indexOf(name as (typeof USAGE_CATEGORIES)[number]);
    if (builtIn >= 0) return builtIn;
    return name === UNCATEGORIZED ? 99 : 10;
  };
  const groups: BoardGroup[] = Array.from(groupMap.entries())
    .map(([name, products]) => ({ name, products }))
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));

  const uncategorized = groupMap.get(UNCATEGORIZED)?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Inventory</h1>
          <p className="mt-1 text-foreground-muted">
            {products.length} product{products.length === 1 ? "" : "s"} · {locations.length} location
            {locations.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {products.length > 0 && (
            <a
              href="/api/export/inventory"
              download
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-border-hairline bg-surface-raised px-4 text-sm font-medium text-foreground transition-colors hover:border-foreground-muted"
            >
              Export count sheet
            </a>
          )}
          <LinkButton href="/dashboard/inventory/import-sales" variant="secondary">
            Sync Booker sales
          </LinkButton>
          <LinkButton href="/dashboard/inventory/import" variant="secondary">
            Import spreadsheet
          </LinkButton>
          <LinkButton href="/dashboard/inventory/new">+ Add product</LinkButton>
        </div>
      </div>

      {uncategorized > 0 && (
        <div className="rounded-2xl border border-status-warn/40 bg-status-warn-bg/40 px-5 py-4 text-sm">
          <span className="font-medium">
            {uncategorized} product{uncategorized === 1 ? " isn't" : "s aren't"} marked Backbar or Retail.
          </span>{" "}
          <span className="text-foreground-muted">
            Export the count sheet, fill in the Category column, and import it back — or edit them one
            by one.
          </span>
        </div>
      )}

      {products.length === 0 ? (
        <div className="rounded-2xl border border-border-hairline bg-surface px-6 py-16 text-center">
          <p className="text-foreground-muted">
            No products yet. Import the spreadsheet you already count with — we&rsquo;ll sort
            everything into Backbar and Retail and set up your locations from it.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <LinkButton href="/dashboard/inventory/import">Import spreadsheet</LinkButton>
            <LinkButton href="/dashboard/inventory/new" variant="secondary">
              + Add product
            </LinkButton>
          </div>
        </div>
      ) : (
        <InventoryBoard locations={boardLocations} groups={groups} />
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
