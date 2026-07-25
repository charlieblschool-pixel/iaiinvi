import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { hasInventoryAccess } from "@/lib/billing";

const createProductSchema = z.object({
  name: z.string().min(1),
  unitLabel: z.string().min(1),
  casePackSize: z.coerce.number().int().min(1),
  unitCost: z.coerce.number().min(0),
  avgWeeklyUsage: z.coerce.number().min(0).default(0),
  vendorId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  newCategoryName: z.string().optional(),
  locationId: z.string().min(1),
  onHand: z.coerce.number().int().min(0),
  reorderPoint: z.coerce.number().int().min(0),
});

export async function POST(request: Request) {
  const { organization } = await requireOrg();

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: organization.id },
  });
  if (!hasInventoryAccess(subscription)) {
    return NextResponse.json(
      { error: "Your free trial has ended — subscribe to keep adding inventory." },
      { status: 402 },
    );
  }

  const body = await request.json();
  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const {
    name,
    unitLabel,
    casePackSize,
    unitCost,
    avgWeeklyUsage,
    vendorId,
    categoryId,
    newCategoryName,
    locationId,
    onHand,
    reorderPoint,
  } = parsed.data;

  const location = await prisma.location.findFirst({
    where: { id: locationId, organizationId: organization.id },
  });
  if (!location) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  let resolvedCategoryId = categoryId || null;
  if (!resolvedCategoryId && newCategoryName?.trim()) {
    const category = await prisma.category.upsert({
      where: {
        organizationId_name: { organizationId: organization.id, name: newCategoryName.trim() },
      },
      update: {},
      create: { name: newCategoryName.trim(), organizationId: organization.id },
    });
    resolvedCategoryId = category.id;
  }

  const product = await prisma.product.create({
    data: {
      name,
      unitLabel,
      casePackSize,
      unitCost,
      avgWeeklyUsage,
      vendorId: vendorId || null,
      categoryId: resolvedCategoryId,
      organizationId: organization.id,
      stockLevels: {
        create: { locationId, onHand, reorderPoint },
      },
    },
  });

  await prisma.activityLogEntry.create({
    data: {
      organizationId: organization.id,
      type: "STOCK_ADJUSTED",
      message: `${name} added to ${location.name} — ${onHand} ${unitLabel}${onHand === 1 ? "" : "s"} on hand`,
    },
  });

  return NextResponse.json({ ok: true, id: product.id });
}
