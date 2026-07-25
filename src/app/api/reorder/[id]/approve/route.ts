import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { placeVendorOrder } from "@/lib/vendor-ordering";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { organization } = await requireOrg();
  const { id } = await params;

  const suggestion = await prisma.reorderSuggestion.findFirst({
    where: { id, organizationId: organization.id, status: "PENDING" },
    include: { product: { include: { vendor: true } } },
  });
  if (!suggestion) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.reorderSuggestion.update({
      where: { id },
      data: { status: "APPROVED", resolvedAt: new Date() },
    }),
    prisma.activityLogEntry.create({
      data: {
        organizationId: organization.id,
        type: "SUGGESTION_APPROVED",
        message: `Approved order — ${suggestion.quantity} ${suggestion.product.unitLabel}${suggestion.quantity === 1 ? "" : "s"} of ${suggestion.product.name} ($${suggestion.totalCost.toFixed(2)})`,
      },
    }),
  ]);

  let vendorOrder: { status: string; message: string; reviewUrl?: string } | null = null;
  if (suggestion.product.vendor) {
    const result = await placeVendorOrder(suggestion.product.vendor, [
      {
        productName: suggestion.product.name,
        quantity: suggestion.quantity,
        unitLabel: suggestion.product.unitLabel,
      },
    ]);
    vendorOrder = result;
    if (result.status === "ready_for_review") {
      await prisma.activityLogEntry.create({
        data: {
          organizationId: organization.id,
          type: "SETTINGS_CHANGED",
          message: result.message,
        },
      });
    }
  }

  return NextResponse.json({ ok: true, vendorOrder });
}
