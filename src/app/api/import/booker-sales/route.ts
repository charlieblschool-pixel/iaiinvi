import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { hasInventoryAccess } from "@/lib/billing";
import { generateSuggestions } from "@/lib/reorder-engine";

const rowSchema = z.object({
  productName: z.string().min(1),
  quantity: z.coerce.number().min(0),
  category: z.string().optional(),
});

const bodySchema = z.object({
  rows: z.array(rowSchema).min(1).max(2000),
  periodDays: z.coerce.number().min(1).max(90).default(7),
});

// Locations sales are most likely pulled from, in priority order.
const SELL_LOCATION_PRIORITY = ["RETAIL_SHELF", "FRONT_COUNTER", "BACKBAR"];

export async function POST(request: Request) {
  const { organization } = await requireOrg();

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: organization.id },
  });
  if (!hasInventoryAccess(subscription)) {
    return NextResponse.json(
      { error: "Your free trial has ended — subscribe to keep syncing sales." },
      { status: 402 },
    );
  }

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid sales data" },
      { status: 400 },
    );
  }
  const { periodDays } = parsed.data;

  // Aggregate quantity sold per product name (a Booker export can list the
  // same item across multiple sales/dates).
  const aggregated = new Map<string, { displayName: string; category?: string; quantity: number }>();
  for (const row of parsed.data.rows) {
    const key = row.productName.trim().toLowerCase();
    const existing = aggregated.get(key);
    if (existing) {
      existing.quantity += row.quantity;
      existing.category = existing.category ?? row.category;
    } else {
      aggregated.set(key, {
        displayName: row.productName.trim(),
        category: row.category,
        quantity: row.quantity,
      });
    }
  }

  const products = await prisma.product.findMany({
    where: { organizationId: organization.id },
    include: { category: true, stockLevels: { include: { location: true } } },
  });

  const summary: Array<{
    productName: string;
    category: string | null;
    quantity: number;
    matched: boolean;
    newOnHand: number | null;
    newAvgWeeklyUsage: number | null;
  }> = [];

  let updatedCount = 0;

  for (const entry of aggregated.values()) {
    const key = entry.displayName.toLowerCase();
    const product =
      products.find((p) => p.name.toLowerCase() === key) ??
      products.find((p) => p.name.toLowerCase().includes(key) || key.includes(p.name.toLowerCase()));

    if (!product) {
      summary.push({
        productName: entry.displayName,
        category: entry.category ?? null,
        quantity: entry.quantity,
        matched: false,
        newOnHand: null,
        newAvgWeeklyUsage: null,
      });
      continue;
    }

    const weeklyRate = (entry.quantity / periodDays) * 7;
    const newAvgWeeklyUsage =
      product.avgWeeklyUsage > 0
        ? Math.round(((product.avgWeeklyUsage + weeklyRate) / 2) * 100) / 100
        : Math.round(weeklyRate * 100) / 100;

    const sellStock =
      SELL_LOCATION_PRIORITY.map((type) =>
        product.stockLevels.find((s) => s.location.type === type),
      ).find(Boolean) ?? product.stockLevels[0];

    let newOnHand: number | null = null;
    if (sellStock) {
      newOnHand = Math.max(0, sellStock.onHand - entry.quantity);
      await prisma.stockLevel.update({
        where: { id: sellStock.id },
        data: { onHand: newOnHand },
      });
    }

    await prisma.product.update({
      where: { id: product.id },
      data: { avgWeeklyUsage: newAvgWeeklyUsage },
    });

    updatedCount += 1;
    summary.push({
      productName: product.name,
      category: product.category?.name ?? entry.category ?? null,
      quantity: entry.quantity,
      matched: true,
      newOnHand,
      newAvgWeeklyUsage,
    });
  }

  const unmatchedCount = summary.filter((s) => !s.matched).length;

  await prisma.activityLogEntry.create({
    data: {
      organizationId: organization.id,
      type: "STOCK_ADJUSTED",
      message: `Booker sales sync — updated ${updatedCount} product${updatedCount === 1 ? "" : "s"}${unmatchedCount > 0 ? `, ${unmatchedCount} not found in inventory` : ""}`,
    },
  });

  try {
    await generateSuggestions(organization.id);
  } catch {
    // Non-fatal — the cron job will pick up any missed suggestions later.
  }

  return NextResponse.json({ ok: true, summary, updatedCount, unmatchedCount });
}
