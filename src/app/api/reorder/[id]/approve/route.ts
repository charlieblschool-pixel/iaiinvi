import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { organization } = await requireOrg();
  const { id } = await params;

  const suggestion = await prisma.reorderSuggestion.findFirst({
    where: { id, organizationId: organization.id, status: "PENDING" },
    include: { product: true },
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

  return NextResponse.json({ ok: true });
}
