import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { hasInventoryAccess } from "@/lib/billing";
import { findOrCreateCategory, findOrCreateLocation } from "@/lib/catalog";
import { reserveProductCodes } from "@/lib/product-codes";

const createProductSchema = z
  .object({
    name: z.string().trim().min(1, "Product name is required").max(200),
    brand: z.string().trim().max(100).optional(),
    sku: z.string().trim().max(80).optional(),
    unitLabel: z.string().trim().min(1, "Unit is required").max(40),
    casePackSize: z.coerce.number().int().min(1),
    unitCost: z.coerce.number().min(0),
    avgWeeklyUsage: z.coerce.number().min(0).default(0),
    vendorId: z.string().optional().nullable(),
    categoryId: z.string().optional().nullable(),
    newCategoryName: z.string().trim().max(60).optional(),
    locationId: z.string().optional(),
    newLocationName: z.string().trim().max(60).optional(),
    onHand: z.coerce.number().int().min(0),
    reorderPoint: z.coerce.number().int().min(0),
  })
  .refine((d) => d.locationId || d.newLocationName, {
    message: "Choose a location",
    path: ["locationId"],
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
    brand,
    sku,
    unitLabel,
    casePackSize,
    unitCost,
    avgWeeklyUsage,
    vendorId,
    categoryId,
    newCategoryName,
    locationId,
    newLocationName,
    onHand,
    reorderPoint,
  } = parsed.data;

  const location = newLocationName
    ? await findOrCreateLocation(organization.id, newLocationName)
    : await prisma.location.findFirst({
        where: { id: locationId, organizationId: organization.id },
      });
  if (!location) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  let resolvedCategoryId: string | null = null;
  if (categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, organizationId: organization.id },
    });
    if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });
    resolvedCategoryId = category.id;
  } else if (newCategoryName) {
    resolvedCategoryId = (await findOrCreateCategory(organization.id, newCategoryName)).id;
  }

  if (vendorId) {
    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, organizationId: organization.id },
    });
    if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  const product = await prisma.$transaction(async (tx) => {
    const [code] = await reserveProductCodes(tx, organization.id, 1);
    return tx.product.create({
      data: {
        code,
        name,
        brand: brand || null,
        sku: sku || null,
        unitLabel,
        casePackSize,
        unitCost,
        avgWeeklyUsage,
        vendorId: vendorId || null,
        categoryId: resolvedCategoryId,
        organizationId: organization.id,
        stockLevels: {
          create: { locationId: location.id, onHand, reorderPoint },
        },
      },
    });
  });

  await prisma.activityLogEntry.create({
    data: {
      organizationId: organization.id,
      type: "STOCK_ADJUSTED",
      message: `${name} (${product.code}) added to ${location.name} — ${onHand} ${unitLabel}${onHand === 1 ? "" : "s"} on hand`,
    },
  });

  return NextResponse.json({ ok: true, id: product.id, code: product.code });
}
