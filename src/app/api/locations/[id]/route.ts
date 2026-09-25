import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { LOCATION_ORDER, cleanLocationName } from "@/lib/locations";

const schema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    move: z.enum(["up", "down"]).optional(),
  })
  .refine((d) => d.name !== undefined || d.move !== undefined, "Nothing to change");

async function findLocation(organizationId: string, id: string) {
  return prisma.location.findFirst({ where: { id, organizationId } });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { organization } = await requireOrg();
  const { id } = await params;

  const location = await findLocation(organization.id, id);
  if (!location) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid name" },
      { status: 400 },
    );
  }

  if (parsed.data.move) {
    // Normalize to 1..n in the current display order, then swap neighbours.
    const ordered = await prisma.location.findMany({
      where: { organizationId: organization.id },
      orderBy: LOCATION_ORDER,
    });
    const index = ordered.findIndex((l) => l.id === id);
    const swapWith = parsed.data.move === "up" ? index - 1 : index + 1;
    if (swapWith >= 0 && swapWith < ordered.length) {
      [ordered[index], ordered[swapWith]] = [ordered[swapWith], ordered[index]];
    }
    await prisma.$transaction(
      ordered.map((l, i) => prisma.location.update({ where: { id: l.id }, data: { sortOrder: i + 1 } })),
    );
    return NextResponse.json({ ok: true });
  }

  const name = cleanLocationName(parsed.data.name!);
  if (!name) return NextResponse.json({ error: "Enter a location name" }, { status: 400 });
  const clash = await prisma.location.findFirst({
    where: { organizationId: organization.id, id: { not: id }, name: { equals: name, mode: "insensitive" } },
  });
  if (clash) {
    return NextResponse.json({ error: `You already have "${clash.name}"` }, { status: 409 });
  }

  const updated = await prisma.location.update({
    where: { id: location.id },
    data: { name },
  });

  await prisma.activityLogEntry.create({
    data: {
      organizationId: organization.id,
      type: "SETTINGS_CHANGED",
      message: `Renamed location "${location.name}" to "${updated.name}"`,
    },
  });

  return NextResponse.json({ ok: true, location: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { organization, membership } = await requireOrg();
  const { id } = await params;

  if (membership.role === "STAFF") {
    return NextResponse.json({ error: "Only owners and admins can delete locations." }, { status: 403 });
  }

  const location = await findLocation(organization.id, id);
  if (!location) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  // Stock counts at this location are removed with it; products themselves stay.
  await prisma.location.delete({ where: { id: location.id } });

  await prisma.activityLogEntry.create({
    data: {
      organizationId: organization.id,
      type: "SETTINGS_CHANGED",
      message: `Deleted location "${location.name}"`,
    },
  });

  return NextResponse.json({ ok: true });
}
