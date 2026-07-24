import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { LOCATION_LABELS } from "@/lib/locations";

const rowSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  unit: z.string().optional(),
  casePackSize: z.coerce.number().optional(),
  unitCost: z.coerce.number().optional(),
  vendorName: z.string().optional(),
  locationName: z.string().optional(),
  onHand: z.coerce.number().optional(),
  reorderPoint: z.coerce.number().optional(),
});

const bodySchema = z.object({
  rows: z.array(rowSchema).min(1).max(2000),
});

const DEFAULT_LEAD_TIME_DAYS = 7;

export async function POST(request: Request) {
  const { organization } = await requireOrg();
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
  const fallbackLocation =
    locations.find((l) => l.type === "STOREROOM") ?? locations[0];

  function matchLocation(name?: string) {
    if (!name) return fallbackLocation;
    const q = name.trim().toLowerCase();
    const found = locations.find(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        q.includes(l.name.toLowerCase()) ||
        LOCATION_LABELS[l.type].toLowerCase().includes(q) ||
        q.includes(LOCATION_LABELS[l.type].toLowerCase()),
    );
    return found ?? fallbackLocation;
  }

  const categoryCache = new Map<string, string>();
  const vendorCache = new Map<string, string>();
  let unmatchedLocations = 0;
  let created = 0;

  for (const row of parsed.data.rows) {
    let categoryId: string | null = null;
    if (row.category?.trim()) {
      const key = row.category.trim().toLowerCase();
      if (categoryCache.has(key)) {
        categoryId = categoryCache.get(key)!;
      } else {
        const category = await prisma.category.upsert({
          where: {
            organizationId_name: {
              organizationId: organization.id,
              name: row.category.trim(),
            },
          },
          update: {},
          create: { name: row.category.trim(), organizationId: organization.id },
        });
        categoryCache.set(key, category.id);
        categoryId = category.id;
      }
    }

    let vendorId: string | null = null;
    if (row.vendorName?.trim()) {
      const key = row.vendorName.trim().toLowerCase();
      if (vendorCache.has(key)) {
        vendorId = vendorCache.get(key)!;
      } else {
        let vendor = await prisma.vendor.findFirst({
          where: { organizationId: organization.id, name: row.vendorName.trim() },
        });
        if (!vendor) {
          vendor = await prisma.vendor.create({
            data: {
              name: row.vendorName.trim(),
              leadTimeDays: DEFAULT_LEAD_TIME_DAYS,
              organizationId: organization.id,
            },
          });
        }
        vendorCache.set(key, vendor.id);
        vendorId = vendor.id;
      }
    }

    const location = matchLocation(row.locationName);
    if (!location) continue;
    if (row.locationName && !location.name.toLowerCase().includes(row.locationName.trim().toLowerCase())) {
      unmatchedLocations += 1;
    }

    await prisma.product.create({
      data: {
        name: row.name.trim(),
        unitLabel: row.unit?.trim() || "unit",
        casePackSize: row.casePackSize && row.casePackSize > 0 ? Math.round(row.casePackSize) : 1,
        unitCost: row.unitCost ?? 0,
        categoryId,
        vendorId,
        organizationId: organization.id,
        stockLevels: {
          create: {
            locationId: location.id,
            onHand: row.onHand ? Math.round(row.onHand) : 0,
            reorderPoint: row.reorderPoint ? Math.round(row.reorderPoint) : 0,
          },
        },
      },
    });
    created += 1;
  }

  await prisma.activityLogEntry.create({
    data: {
      organizationId: organization.id,
      type: "STOCK_ADJUSTED",
      message: `Imported ${created} product${created === 1 ? "" : "s"} from a spreadsheet`,
    },
  });

  return NextResponse.json({ ok: true, created, unmatchedLocations });
}
