import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { stripe, stripeEnabled, STANDARD_PLAN } from "@/lib/stripe";

export async function POST(request: Request) {
  if (!stripeEnabled || !stripe) {
    return NextResponse.json(
      { error: "Stripe isn't configured yet. Add STRIPE_SECRET_KEY to .env.local." },
      { status: 503 },
    );
  }

  const { session, organization } = await requireOrg();
  const origin = new URL(request.url).origin;

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: organization.id },
  });

  // If the org still has trial days left and hasn't paid before, carry the
  // remaining trial into Stripe so the card isn't charged until it ends.
  const remainingTrialEnd =
    subscription?.status === "trialing" &&
    subscription.trialEndsAt &&
    subscription.trialEndsAt.getTime() > Date.now() &&
    !subscription.stripeSubscriptionId
      ? Math.floor(subscription.trialEndsAt.getTime() / 1000)
      : undefined;

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: subscription?.stripeCustomerId ?? undefined,
    customer_email: subscription?.stripeCustomerId ? undefined : session.user.email ?? undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: `invii.ai — ${STANDARD_PLAN.name} plan` },
          unit_amount: STANDARD_PLAN.amountCents,
          recurring: { interval: "month" },
        },
        quantity: 1,
      },
    ],
    subscription_data: remainingTrialEnd ? { trial_end: remainingTrialEnd } : undefined,
    metadata: { organizationId: organization.id },
    success_url: `${origin}/dashboard/billing?checkout=success`,
    cancel_url: `${origin}/dashboard/billing?checkout=cancelled`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
