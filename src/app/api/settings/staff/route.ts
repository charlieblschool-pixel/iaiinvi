import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";

const staffSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "STAFF"]),
});

export async function POST(request: Request) {
  const { organization, membership } = await requireOrg();

  if (membership.role !== "OWNER") {
    return NextResponse.json(
      { error: "Only the workspace owner can add staff logins." },
      { status: 403 },
    );
  }

  const body = await request.json();
  const parsed = staffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const { name, email, password, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists" },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      memberships: { create: { organizationId: organization.id, role } },
    },
  });

  await prisma.activityLogEntry.create({
    data: {
      organizationId: organization.id,
      userId: membership.userId,
      type: "MEMBER_INVITED",
      message: `${name} was added as ${role === "ADMIN" ? "an admin" : "staff"}`,
    },
  });

  return NextResponse.json({ ok: true, userId: user.id });
}
