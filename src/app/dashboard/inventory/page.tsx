import { Fragment } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireInventoryAccess } from "@/lib/session";
import { stockStatus } from "@/lib/inventory";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { AutoReorderToggle } from "@/components/dashboard/auto-reorder-toggle";

export default async function InventoryPage() {
  const { organization } = await requireInventoryAccess();

  const locations = await prisma.location.findMany({
    where: { organizationId: organization.id },
    include: {
      stockLevels: {
        include: { product: { include: { category: true } } },
        orderBy: { product: { name: "asc" } },
      },
    },
  });

  const productCount = await prisma.product.count({
    where: { organizationId: organization.id },
  });

  const locationsWithStock = locations.filter((l) => l.stockLevels.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Inventory</h1>
          <p className="mt-1 text-foreground-muted">
            {productCount} product{productCount === 1 ? "" : "s"} ·{" "}
            {locations.length} locations
          </p>
        </div>
        <div className="flex gap-3">
          <LinkButton href="/dashboard/inventory/import" variant="secondary">
            Import spreadsheet
          </LinkButton>
          <LinkButton href="/dashboard/inventory/new">+ Add product</LinkButton>
        </div>
      </div>

      {locationsWithStock.length === 0 ? (
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
        <div className="overflow-hidden rounded-2xl border border-border-hairline bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-foreground-muted">
                <th className="px-6 py-3 font-medium">Product</th>
                <th className="px-6 py-3 font-medium">Category</th>
                <th className="px-6 py-3 font-medium">On hand</th>
                <th className="px-6 py-3 font-medium">Reorder pt</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Auto-reorder</th>
              </tr>
            </thead>
            <tbody>
              {locationsWithStock.map((location) => (
                <Fragment key={location.id}>
                  <tr className="border-t border-border-hairline bg-surface-raised/40">
                    <td
                      colSpan={6}
                      className="px-6 py-2 text-xs font-medium uppercase tracking-wider text-brand-light"
                    >
                      {location.name}
                    </td>
                  </tr>
                  {location.stockLevels.map((s) => {
                    const status = stockStatus(s.onHand, s.reorderPoint);
                    return (
                      <tr key={s.id} className="border-t border-border-hairline">
                        <td className="px-6 py-3">{s.product.name}</td>
                        <td className="px-6 py-3 text-foreground-muted">
                          {s.product.category?.name ?? "—"}
                        </td>
                        <td className="px-6 py-3 text-foreground-muted">
                          {s.onHand} {s.product.unitLabel}
                          {s.onHand === 1 ? "" : "s"}
                        </td>
                        <td className="px-6 py-3 text-foreground-muted">
                          {s.reorderPoint}
                        </td>
                        <td className="px-6 py-3">
                          <Badge tone={status.tone}>{status.label}</Badge>
                        </td>
                        <td className="px-6 py-3">
                          <AutoReorderToggle
                            productId={s.product.id}
                            productName={s.product.name}
                            initialValue={s.product.autoReorder}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
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
