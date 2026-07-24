import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { stripe, stripeEnabled } from "@/lib/stripe";

export async function POST(request: Request) {
  if (!stripeEnabled || !stripe) {
    return NextResponse.json(
      { error: "Stripe isn't configured yet. Add STRIPE_SECRET_KEY to .env.local." },
      { status: 503 },
    );
  }

  const { organization } = await requireOrg();
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: organization.id },
  });

  if (!subscription?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No billing account yet — start a plan first." },
      { status: 400 },
    );
  }

  const origin = new URL(request.url).origin;
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${origin}/dashboard/billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
