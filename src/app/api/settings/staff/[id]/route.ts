import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";

const patchSchema = z.object({ role: z.enum(["ADMIN", "STAFF"]) });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { organization, membership } = await requireOrg();
  if (membership.role !== "OWNER") {
    return NextResponse.json(
      { error: "Only the workspace owner can change roles." },
      { status: 403 },
    );
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const target = await prisma.membership.findFirst({
    where: { id, organizationId: organization.id },
  });
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (target.role === "OWNER") {
    return NextResponse.json(
      { error: "The workspace owner's role can't be changed." },
      { status: 400 },
    );
  }

  await prisma.membership.update({
    where: { id },
    data: { role: parsed.data.role },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { organization, membership } = await requireOrg();
  if (membership.role !== "OWNER") {
    return NextResponse.json(
      { error: "Only the workspace owner can remove staff." },
      { status: 403 },
    );
  }

  const { id } = await params;
  const target = await prisma.membership.findFirst({
    where: { id, organizationId: organization.id },
    include: { user: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (target.role === "OWNER") {
    return NextResponse.json(
      { error: "The workspace owner can't be removed." },
      { status: 400 },
    );
  }

  await prisma.membership.delete({ where: { id } });

  await prisma.activityLogEntry.create({
    data: {
      organizationId: organization.id,
      userId: membership.userId,
      type: "SETTINGS_CHANGED",
      message: `${target.user.name ?? target.user.email} was removed from the workspace`,
    },
  });

  return NextResponse.json({ ok: true });
}
