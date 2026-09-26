import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { MOVEMENT_LABELS } from "@/lib/tracking";

/** Undo a tracked entry: delete it and put the stock back where it came from. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { organization, session } = await requireOrg();
  const { id } = await params;

  const movement = await prisma.stockMovement.findFirst({
    where: { id, organizationId: organization.id },
    include: { product: true, location: true },
  });
  if (!movement) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    if (movement.locationId && movement.takenFromStock > 0) {
      await tx.stockLevel.updateMany({
        where: { productId: movement.productId, locationId: movement.locationId },
        data: { onHand: { increment: movement.takenFromStock } },
      });
    }
    await tx.stockMovement.delete({ where: { id: movement.id } });
    await tx.activityLogEntry.create({
      data: {
        organizationId: organization.id,
        userId: session.user.id,
        type: "STOCK_ADJUSTED",
        message: `Undid: ${movement.quantity} × ${movement.product.name} ${MOVEMENT_LABELS[movement.type].past}${
          movement.location ? ` — returned to ${movement.location.name}` : ""
        }`,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
