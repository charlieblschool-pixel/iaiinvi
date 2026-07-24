import { prisma } from "@/lib/prisma";

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diffToMonday);
  return d;
}

/**
 * Rolls up every resolved reorder charge from the most recently completed
 * week into one invoice. Idempotent per organization per week.
 */
export async function generateWeeklyInvoice(organizationId: string) {
  const thisWeekStart = startOfWeek(new Date());
  const periodStart = new Date(thisWeekStart);
  periodStart.setDate(periodStart.getDate() - 7);
  const periodEnd = thisWeekStart;

  const existing = await prisma.invoice.findUnique({
    where: { organizationId_periodStart: { organizationId, periodStart } },
  });
  if (existing) return existing;

  const charges = await prisma.reorderSuggestion.findMany({
    where: {
      organizationId,
      status: { in: ["APPROVED", "AUTO_CHARGED"] },
      resolvedAt: { gte: periodStart, lt: periodEnd },
      invoiceId: null,
    },
  });

  if (charges.length === 0) return null;

  const totalAmount = charges.reduce((sum, c) => sum + c.totalCost, 0);

  const invoice = await prisma.invoice.create({
    data: {
      organizationId,
      periodStart,
      periodEnd,
      totalAmount,
      itemCount: charges.length,
      charges: { connect: charges.map((c) => ({ id: c.id })) },
    },
  });

  await prisma.activityLogEntry.create({
    data: {
      organizationId,
      type: "SETTINGS_CHANGED",
      message: `Generated weekly invoice for ${periodStart.toLocaleDateString()}–${periodEnd.toLocaleDateString()} — $${totalAmount.toFixed(2)} across ${charges.length} order${charges.length === 1 ? "" : "s"}`,
    },
  });

  return invoice;
}
