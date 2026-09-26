import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { MOVEMENT_LABELS } from "@/lib/tracking";
import { parseRange, rangeStart } from "@/lib/tracking-report";
import { usageCategoryFromName } from "@/lib/categories";

export async function GET(request: Request) {
  const { organization } = await requireOrg();
  const range = parseRange(new URL(request.url).searchParams.get("range") ?? undefined);
  const since = rangeStart(range);

  const movements = await prisma.stockMovement.findMany({
    where: { organizationId: organization.id, ...(since ? { createdAt: { gte: since } } : {}) },
    include: { product: { include: { category: true } }, location: true, user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  const csv = Papa.unparse(
    movements.map((m) => ({
      Date: m.createdAt.toISOString(),
      Type: MOVEMENT_LABELS[m.type].label,
      Code: m.product.code,
      Product: m.product.name,
      Category: usageCategoryFromName(m.product.category?.name) ?? m.product.category?.name ?? "",
      Quantity: m.quantity,
      Location: m.location?.name ?? "",
      "Unit cost": m.unitCost,
      "Cost value": Number((m.quantity * m.unitCost).toFixed(2)),
      "Tracked by": m.user?.name ?? m.user?.email ?? "",
      Note: m.note ?? "",
    })),
  );

  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sold-used-wasted-${range}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
