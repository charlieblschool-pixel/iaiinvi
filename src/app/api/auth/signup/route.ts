import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { DEFAULT_LOCATIONS, LOCATION_LABELS } from "@/lib/locations";
import { trialEndDate } from "@/lib/billing";

const signupSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  businessName: z.string().min(1),
});

export async function POST(request: Request) {
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

  return NextResponse.json({ ok: true });
}
