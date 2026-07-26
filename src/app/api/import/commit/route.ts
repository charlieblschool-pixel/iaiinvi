import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { hasInventoryAccess } from "@/lib/billing";

const stockSchema = z.object({
  locationId: z.string().min(1),
  onHand: z.coerce.number().optional(),
  reorderPoint: z.coerce.number().optional(),
});

const rowSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  unit: z.string().optional(),
  casePackSize: z.coerce.number().optional(),
  unitCost: z.coerce.number().optional(),
  vendorName: z.string().optional(),
  stocks: z.array(stockSchema).optional(),
});

const bodySchema = z.object({
  rows: z.array(rowSchema).min(1).max(2000),
});

const DEFAULT_LEAD_TIME_DAYS = 7;

export async function POST(request: Request) {
  const { organization } = await requireOrg();

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: organization.id },
  });
  if (!hasInventoryAccess(subscription)) {
    return NextResponse.json(
      { error: "Your free trial has ended — subscribe to keep importing inventory." },
      { status: 402 },
    );
  }

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid import data" },
      { status: 400 },
    );
  }

  const locations = await prisma.location.findMany({
    where: { organizationId: organization.id },
  });
  const validLocationIds = new Set(locations.map((l) => l.id));
  const fallbackLocation =
    locations.find((l) => l.type === "STOREROOM") ?? locations[0];

  const categoryCache = new Map<string, string>();
  const vendorCache = new Map<string, { id: string; name: string }>();
  let created = 0;
  let updated = 0;

  async function resolveCategory(name: string): Promise<string> {
    const key = name.trim().toLowerCase();
    const cached = categoryCache.get(key);
    if (cached) return cached;
    const category = await prisma.category.upsert({
      where: { organizationId_name: { organizationId: organization.id, name: name.trim() } },
      update: {},
      create: { name: name.trim(), organizationId: organization.id },
    });
    categoryCache.set(key, category.id);
    return category.id;
  }

  for (const row of parsed.data.rows) {
    let vendor: { id: string; name: string } | null = null;
    if (row.vendorName?.trim()) {
      const key = row.vendorName.trim().toLowerCase();
      const cached = vendorCache.get(key);
      if (cached) {
        vendor = cached;
      } else {
        let vendorRecord = await prisma.vendor.findFirst({
          where: { organizationId: organization.id, name: row.vendorName.trim() },
        });
        if (!vendorRecord) {
          vendorRecord = await prisma.vendor.create({
            data: {
              name: row.vendorName.trim(),
              leadTimeDays: DEFAULT_LEAD_TIME_DAYS,
              organizationId: organization.id,
            },
          });
        }
        vendor = { id: vendorRecord.id, name: vendorRecord.name };
        vendorCache.set(key, vendor);
      }
    }
    const vendorId = vendor?.id ?? null;

    // No explicit category on the row? Group the product under its brand
    // (vendor name) automatically instead of leaving it uncategorized.
    const categoryId = row.category?.trim()
      ? await resolveCategory(row.category)
      : vendor
        ? await resolveCategory(vendor.name)
        : null;

    const existing = await prisma.product.findFirst({
      where: {
        organizationId: organization.id,
        name: { equals: row.name.trim(), mode: "insensitive" },
      },
    });

    let productId: string;
    if (existing) {
      const product = await prisma.product.update({
        where: { id: existing.id },
        data: {
          unitLabel: row.unit?.trim() || undefined,
          casePackSize: row.casePackSize && row.casePackSize > 0 ? Math.round(row.casePackSize) : undefined,
          unitCost: row.unitCost,
          categoryId: categoryId ?? undefined,
          vendorId: vendorId ?? undefined,
        },
      });
      productId = product.id;
      updated += 1;
    } else {
      const product = await prisma.product.create({
        data: {
          name: row.name.trim(),
          unitLabel: row.unit?.trim() || "unit",
          casePackSize: row.casePackSize && row.casePackSize > 0 ? Math.round(row.casePackSize) : 1,
          unitCost: row.unitCost ?? 0,
          categoryId,
          vendorId,
          organizationId: organization.id,
        },
      });
      productId = product.id;
      created += 1;
    }

    const stocks = (row.stocks ?? []).filter((s) => validLocationIds.has(s.locationId));

    if (stocks.length === 0) {
      if (fallbackLocation) {
        await prisma.stockLevel.upsert({
          where: { productId_locationId: { productId, locationId: fallbackLocation.id } },
          update: {},
          create: { productId, locationId: fallbackLocation.id, onHand: 0, reorderPoint: 0 },
        });
      }
      continue;
    }

    for (const stock of stocks) {
      await prisma.stockLevel.upsert({
        where: { productId_locationId: { productId, locationId: stock.locationId } },
        update: {
          onHand: stock.onHand !== undefined ? Math.round(stock.onHand) : undefined,
          reorderPoint: stock.reorderPoint !== undefined ? Math.round(stock.reorderPoint) : undefined,
        },
        create: {
          productId,
          locationId: stock.locationId,
          onHand: stock.onHand ? Math.round(stock.onHand) : 0,
          reorderPoint: stock.reorderPoint ? Math.round(stock.reorderPoint) : 0,
        },
      });
    }
  }

  await prisma.activityLogEntry.create({
    data: {
      organizationId: organization.id,
      type: "STOCK_ADJUSTED",
      message: `Imported spreadsheet — ${created} new product${created === 1 ? "" : "s"}, ${updated} updated`,
    },
  });

  return NextResponse.json({ ok: true, created, updated });
}
