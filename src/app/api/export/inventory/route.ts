import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { LOCATION_ORDER } from "@/lib/locations";
import { USAGE_CATEGORIES, usageCategoryFromName } from "@/lib/categories";
import { slugify } from "@/lib/slugify";

// A count sheet in the exact shape the importer reads back: fill in the
// quantities, re-import, and every row updates its product by code.
export async function GET() {
  const { organization } = await requireOrg();

  const [locations, products] = await Promise.all([
    prisma.location.findMany({ where: { organizationId: organization.id }, orderBy: LOCATION_ORDER }),
    prisma.product.findMany({
      where: { organizationId: organization.id },
      include: { category: true, vendor: true, stockLevels: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const categoryRank = (name: string | undefined) => {
    const i = USAGE_CATEGORIES.indexOf(usageCategoryFromName(name) as (typeof USAGE_CATEGORIES)[number]);
    return i >= 0 ? i : 9;
  };
  products.sort(
    (a, b) => categoryRank(a.category?.name) - categoryRank(b.category?.name) || a.name.localeCompare(b.name),
  );

  const header = [
    "Code",
    "Product",
    "Category",
    "Brand",
    "Vendor",
    "SKU",
    "Unit",
    "Case pack",
    "Unit cost",
    ...locations.flatMap((l) => [`${l.name} qty`, `${l.name} reorder pt`]),
  ];

  const rows = products.map((p) => {
    const byLocation = new Map(p.stockLevels.map((s) => [s.locationId, s]));
    return [
      p.code,
      p.name,
      p.category?.name ?? "",
      p.brand ?? "",
      p.vendor?.name ?? "",
      p.sku ?? "",
      p.unitLabel,
      p.casePackSize,
      p.unitCost,
      ...locations.flatMap((l): (number | string)[] => {
        const s = byLocation.get(l.id);
        return s ? [s.onHand, s.reorderPoint] : ["", ""];
      }),
    ];
  });

  const csv = "﻿" + Papa.unparse([header, ...rows]);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${slugify(organization.name) || "inventory"}-count-sheet-${date}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
