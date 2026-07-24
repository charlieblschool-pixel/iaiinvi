import { prisma } from "@/lib/prisma";
import { roundUpToCasePack } from "@/lib/inventory";
import { stripe, stripeEnabled } from "@/lib/stripe";

const SAFETY_BUFFER_DAYS = 7;
const DEFAULT_LEAD_TIME_DAYS = 7;
const DEDUPE_WINDOW_HOURS = 24;

export async function countRecentAutoCharges(organizationId: string) {
  return prisma.reorderSuggestion.count({
    where: {
      organizationId,
      status: "AUTO_CHARGED",
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
}

function buildReasoning({
  onHand,
  reorderPoint,
  leadTimeDays,
  casePackSize,
  quantity,
  rawNeeded,
}: {
  onHand: number;
  reorderPoint: number;
  leadTimeDays: number;
  casePackSize: number;
  quantity: number;
  rawNeeded: number;
}): string {
  let lede: string;
  if (onHand <= 0) {
    lede = "Out of stock with steady demand — prioritize this order today.";
  } else if (onHand <= Math.ceil(reorderPoint / 2)) {
    lede =
      "Usage is accelerating — you'll hit zero before the next restock lands. Order now.";
  } else {
    lede = `Stock is at the reorder point based on a ${leadTimeDays}-day vendor lead time — order to stay ahead.`;
  }

  if (casePackSize > 1 && quantity > Math.ceil(rawNeeded)) {
    return `${lede} Rounded up to a full case of ${casePackSize}.`;
  }
  return lede;
}

/**
 * Scans stock levels below their reorder point and creates a suggestion per
 * product: auto-charged immediately if the product has auto-reorder on,
 * otherwise queued as pending for manual approval.
 */
export async function generateSuggestions(organizationId: string) {
  const stockLevels = await prisma.stockLevel.findMany({
    where: { product: { organizationId } },
    include: { product: { include: { vendor: true } }, location: true },
  });

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
  });
  const canAutoCharge = Boolean(
    stripeEnabled &&
      stripe &&
      subscription?.stripeCustomerId &&
      subscription?.stripePaymentMethodId,
  );

  const dedupeSince = new Date(Date.now() - DEDUPE_WINDOW_HOURS * 60 * 60 * 1000);

  for (const stock of stockLevels) {
    if (stock.onHand > stock.reorderPoint) continue;

    const recentSuggestion = await prisma.reorderSuggestion.findFirst({
      where: {
        productId: stock.productId,
        createdAt: { gte: dedupeSince },
      },
    });
    if (recentSuggestion) continue;

    const { product } = stock;
    const leadTimeDays = product.vendor?.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS;
    const coverageDays = leadTimeDays + SAFETY_BUFFER_DAYS;
    const dailyUsage = product.avgWeeklyUsage / 7;
    const targetQty = dailyUsage * coverageDays;
    const rawNeeded = Math.max(
      targetQty - stock.onHand,
      product.avgWeeklyUsage > 0 ? 1 : stock.reorderPoint - stock.onHand + 1,
    );
    const quantity = Math.max(
      roundUpToCasePack(rawNeeded, product.casePackSize),
      product.casePackSize,
    );
    const totalCost = quantity * product.unitCost;

    const reasoning = buildReasoning({
      onHand: stock.onHand,
      reorderPoint: stock.reorderPoint,
      leadTimeDays,
      casePackSize: product.casePackSize,
      quantity,
      rawNeeded,
    });

    if (product.autoReorder && canAutoCharge && stripe && subscription) {
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(totalCost * 100),
          currency: "usd",
          customer: subscription.stripeCustomerId!,
          payment_method: subscription.stripePaymentMethodId!,
          off_session: true,
          confirm: true,
          description: `invii.ai auto-reorder — ${quantity} ${product.unitLabel}${quantity === 1 ? "" : "s"} of ${product.name}`,
          metadata: { organizationId, productId: product.id },
        });

        await prisma.$transaction([
          prisma.reorderSuggestion.create({
            data: {
              organizationId,
              productId: product.id,
              quantity,
              unitCost: product.unitCost,
              totalCost,
              reasoning,
              status: "AUTO_CHARGED",
              resolvedAt: new Date(),
              stripePaymentIntentId: paymentIntent.id,
            },
          }),
          prisma.activityLogEntry.create({
            data: {
              organizationId,
              type: "AUTO_CHARGED",
              message: `Auto-charged $${totalCost.toFixed(2)} — ${quantity} ${product.unitLabel}${quantity === 1 ? "" : "s"} of ${product.name} (${stock.location.name})`,
            },
          }),
        ]);
      } catch (err) {
        const chargeError = err instanceof Error ? err.message : "Card charge failed";
        await prisma.$transaction([
          prisma.reorderSuggestion.create({
            data: {
              organizationId,
              productId: product.id,
              quantity,
              unitCost: product.unitCost,
              totalCost,
              reasoning,
              status: "PENDING",
              chargeError,
            },
          }),
          prisma.activityLogEntry.create({
            data: {
              organizationId,
              type: "SUGGESTION_CREATED",
              message: `Auto-charge failed for ${product.name} (${chargeError}) — queued for manual approval instead`,
            },
          }),
        ]);
      }
    } else if (product.autoReorder) {
      // Auto-reorder is on, but there's no payment method on file yet — queue
      // for manual approval instead of silently failing to reorder.
      await prisma.$transaction([
        prisma.reorderSuggestion.create({
          data: {
            organizationId,
            productId: product.id,
            quantity,
            unitCost: product.unitCost,
            totalCost,
            reasoning,
            status: "PENDING",
            chargeError: "No payment method on file yet",
          },
        }),
        prisma.activityLogEntry.create({
          data: {
            organizationId,
            type: "SUGGESTION_CREATED",
            message: `${product.name} needs reordering, but no payment method is on file — add one in Billing to enable auto-charge`,
          },
        }),
      ]);
    } else {
      await prisma.$transaction([
        prisma.reorderSuggestion.create({
          data: {
            organizationId,
            productId: product.id,
            quantity,
            unitCost: product.unitCost,
            totalCost,
            reasoning,
            status: "PENDING",
          },
        }),
        prisma.activityLogEntry.create({
          data: {
            organizationId,
            type: "SUGGESTION_CREATED",
            message: `New reorder suggestion for ${product.name} (${stock.location.name}) — ${quantity} ${product.unitLabel}${quantity === 1 ? "" : "s"}`,
          },
        }),
      ]);
    }
  }
}
