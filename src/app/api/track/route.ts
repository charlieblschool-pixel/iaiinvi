import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { hasInventoryAccess } from "@/lib/billing";
import { MOVEMENT_LABELS, MOVEMENT_TYPES } from "@/lib/tracking";

const schema = z.object({
  productId: z.string().min(1),
  type: z.enum(MOVEMENT_TYPES),
  quantity: z.coerce.number().int("Whole numbers only").min(1, "Enter at least 1").max(10_000),
  locationId: z.string().min(1).nullable().optional(),
  note: z.string().trim().max(300).optional(),
});

export async function POST(request: Request) {
  const { organization, session } = await requireOrg();

  const subscription = await prisma.subscription.findUnique({ where: { organizationId: organization.id } });
  if (!hasInventoryAccess(subscription)) {
    return NextResponse.json({ error: "Your free trial has ended — subscribe to keep tracking." }, { status: 402 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid entry" }, { status: 400 });
  }
  const { productId, type, quantity, locationId, note } = parsed.data;

  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId: organization.id },
    include: { stockLevels: { include: { location: true } } },
  });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const stock = locationId
    ? product.stockLevels.find((s) => s.locationId === locationId)
    : product.stockLevels.length === 1
      ? product.stockLevels[0]
      : undefined;
  if (locationId && !stock) {
    return NextResponse.json({ error: "That product isn't stocked in that location" }, { status: 400 });
  }
  if (!stock && product.stockLevels.length > 1) {
    return NextResponse.json({ error: "Choose which location it came from" }, { status: 400 });
  }

  // Counts can drift — never go below zero, but keep the tracked quantity
  // exactly as entered so the report stays true.
  const newOnHand = stock ? Math.max(0, stock.onHand - quantity) : null;
  const shortBy = stock ? Math.max(0, quantity - stock.onHand) : 0;

  const movement = await prisma.$transaction(async (tx) => {
    if (stock) {
      await tx.stockLevel.update({ where: { id: stock.id }, data: { onHand: newOnHand! } });
    }
    const created = await tx.stockMovement.create({
      data: {
        type,
        quantity,
        takenFromStock: stock ? stock.onHand - newOnHand! : 0,
        unitCost: product.unitCost,
        note: note || null,
        organizationId: organization.id,
        productId: product.id,
        locationId: stock?.locationId ?? null,
        userId: session.user.id,
      },
    });
    await tx.activityLogEntry.create({
      data: {
        organizationId: organization.id,
        userId: session.user.id,
        type: "STOCK_ADJUSTED",
        message: `${quantity} × ${product.name} (${product.code}) ${MOVEMENT_LABELS[type].past}${
          stock ? ` from ${stock.location.name} — ${newOnHand} left` : ""
        }`,
      },
    });
    return created;
  });

  return NextResponse.json({
    ok: true,
    movementId: movement.id,
    product: { id: product.id, code: product.code, name: product.name },
    locationName: stock?.location.name ?? null,
    newOnHand,
    shortBy,
  });
}
