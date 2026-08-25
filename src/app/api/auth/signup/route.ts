import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { DEFAULT_LOCATIONS, LOCATION_LABELS } from "@/lib/locations";
import { trialEndDate } from "@/lib/billing";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/lib/email";

const signupSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  businessName: z.string().min(1),
});

const VERIFY_TOKEN_TTL_HOURS = 24;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const allowed = await checkRateLimit(`signup:${ip}`, 8, 60);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many signup attempts. Try again in a bit." },
      { status: 429 },
    );
  }

  const body = await request.json();
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const { name, email, password, businessName } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists" },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const baseSlug = slugify(businessName) || "workspace";
  let slug = baseSlug;
  let suffix = 1;
  while (await prisma.organization.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, passwordHash },
    });

    const organization = await tx.organization.create({
      data: {
        name: businessName,
        slug,
        memberships: { create: { userId: user.id, role: "OWNER" } },
        locations: {
          create: DEFAULT_LOCATIONS.map((type) => ({
            type,
            name: LOCATION_LABELS[type],
          })),
        },
        subscription: {
          create: { plan: "STANDARD", status: "trialing", trialEndsAt: trialEndDate() },
        },
      },
    });

    await tx.activityLogEntry.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        type: "MEMBER_INVITED",
        message: `${name} created the ${businessName} workspace`,
      },
    });
  });

  // The account already exists at this point — don't let a hiccup sending
  // the verification email turn into a signup failure.
  try {
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.verificationToken.create({
      data: {
        identifier: `verify:${email}`,
        token,
        expires: new Date(Date.now() + VERIFY_TOKEN_TTL_HOURS * 60 * 60 * 1000),
      },
    });
    const origin = new URL(request.url).origin;
    const verifyUrl = `${origin}/verify-email?email=${encodeURIComponent(email)}&token=${token}`;
    await sendVerificationEmail(email, verifyUrl);
  } catch (err) {
    console.error("[signup] failed to send verification email", err);
  }

  return NextResponse.json({ ok: true });
}
