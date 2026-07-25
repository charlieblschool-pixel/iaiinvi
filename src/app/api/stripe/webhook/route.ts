import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe, stripeEnabled } from "@/lib/stripe";

export async function POST(request: Request) {
  if (!stripeEnabled || !stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const organizationId = session.metadata?.organizationId;
      if (organizationId && session.subscription) {
        const sub = await stripe.subscriptions.retrieve(String(session.subscription), {
          expand: ["default_payment_method"],
        });
        const pm = sub.default_payment_method as Stripe.PaymentMethod | null;

        const trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000) : null;

        await prisma.subscription.upsert({
          where: { organizationId },
          update: {
            plan: "STANDARD",
            status: sub.status,
            trialEndsAt,
            stripeCustomerId: String(session.customer),
            stripeSubscriptionId: sub.id,
            stripePaymentMethodId: pm?.id ?? null,
            cardBrand: pm?.card?.brand ?? null,
            cardLast4: pm?.card?.last4 ?? null,
          },
          create: {
            organizationId,
            plan: "STANDARD",
            status: sub.status,
            trialEndsAt,
            stripeCustomerId: String(session.customer),
            stripeSubscriptionId: sub.id,
            stripePaymentMethodId: pm?.id ?? null,
            cardBrand: pm?.card?.brand ?? null,
            cardLast4: pm?.card?.last4 ?? null,
          },
        });
        await prisma.activityLogEntry.create({
          data: {
            organizationId,
            type: "SETTINGS_CHANGED",
            message: "Subscribed to the invii.ai Standard plan ($100/mo)",
          },
        });
      }
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const periodEnd = sub.items.data[0]?.current_period_end;
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data: {
          status: sub.status,
          trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
          currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
        },
      });
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data: {
          status: "canceled",
          stripeSubscriptionId: null,
          currentPeriodEnd: null,
        },
      });
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
