import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { hasInventoryAccess } from "@/lib/billing";

const stockLevelSchema = z.object({
  locationId: z.string().min(1),
  onHand: z.coerce.number().int().min(0),
  reorderPoint: z.coerce.number().int().min(0),
});

const patchSchema = z.object({
  autoReorder: z.boolean().optional(),
  name: z.string().min(1).optional(),
  unitLabel: z.string().min(1).optional(),
  casePackSize: z.coerce.number().int().min(1).optional(),
  unitCost: z.coerce.number().min(0).optional(),
  avgWeeklyUsage: z.coerce.number().min(0).optional(),
  vendorId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  newCategoryName: z.string().optional(),
  stockLevels: z.array(stockLevelSchema).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { organization } = await requireOrg();

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: organization.id },
  });
  if (!hasInventoryAccess(subscription)) {
    return NextResponse.json(
      { error: "Your free trial has ended — subscribe to keep managing inventory." },
      { status: 402 },
    );
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const product = await prisma.product.findFirst({
    where: { id, organizationId: organization.id },
  });
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const {
    stockLevels,
    newCategoryName,
    categoryId,
    vendorId,
    ...productFields
  } = parsed.data;

  let resolvedCategoryId = categoryId;
  if (categoryId === undefined && newCategoryName?.trim()) {
    const category = await prisma.category.upsert({
      where: {
        organizationId_name: { organizationId: organization.id, name: newCategoryName.trim() },
      },
      update: {},
      create: { name: newCategoryName.trim(), organizationId: organization.id },
    });
    resolvedCategoryId = category.id;
  }

  if (stockLevels) {
    const locations = await prisma.location.findMany({
      where: { organizationId: organization.id, id: { in: stockLevels.map((s) => s.locationId) } },
    });
    const validLocationIds = new Set(locations.map((l) => l.id));
    for (const level of stockLevels) {
      if (!validLocationIds.has(level.locationId)) continue;
      await prisma.stockLevel.upsert({
        where: { productId_locationId: { productId: id, locationId: level.locationId } },
        update: { onHand: level.onHand, reorderPoint: level.reorderPoint },
        create: {
          productId: id,
          locationId: level.locationId,
          onHand: level.onHand,
          reorderPoint: level.reorderPoint,
        },
      });
    }
  }

  const updated = await prisma.product.update({
    where: { id },
    data: {
      ...productFields,
      vendorId: vendorId === undefined ? undefined : vendorId,
      categoryId: resolvedCategoryId === undefined ? undefined : resolvedCategoryId,
    },
  });

  if (parsed.data.autoReorder !== undefined && Object.keys(parsed.data).length === 1) {
    await prisma.activityLogEntry.create({
      data: {
        organizationId: organization.id,
        type: "SETTINGS_CHANGED",
        message: `Auto-reorder ${parsed.data.autoReorder ? "enabled" : "disabled"} for ${product.name}`,
      },
    });
  } else {
    await prisma.activityLogEntry.create({
      data: {
        organizationId: organization.id,
        type: "STOCK_ADJUSTED",
        message: `${product.name} updated`,
      },
    });
  }

  return NextResponse.json({ ok: true, product: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { organization } = await requireOrg();
  const { id } = await params;

  const product = await prisma.product.findFirst({
    where: { id, organizationId: organization.id },
  });
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.product.delete({ where: { id } });

  await prisma.activityLogEntry.create({
    data: {
      organizationId: organization.id,
      type: "STOCK_ADJUSTED",
      message: `${product.name} removed from inventory`,
    },
  });

  return NextResponse.json({ ok: true });
}
