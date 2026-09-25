import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { cleanLocationName } from "@/lib/locations";

const schema = z.object({ name: z.string().trim().min(1, "Enter a location name").max(60) });

export async function POST(request: Request) {
  const { organization } = await requireOrg();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid name" }, { status: 400 });
  }
  const name = cleanLocationName(parsed.data.name);
  if (!name) return NextResponse.json({ error: "Enter a location name" }, { status: 400 });

  const locations = await prisma.location.findMany({ where: { organizationId: organization.id } });
  const duplicate = locations.find((l) => l.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    return NextResponse.json({ error: `You already have "${duplicate.name}"` }, { status: 409 });
  }

  const location = await prisma.location.create({
    data: {
      name,
      organizationId: organization.id,
      sortOrder: locations.reduce((m, l) => Math.max(m, l.sortOrder), 0) + 1,
    },
  });

  await prisma.activityLogEntry.create({
    data: { organizationId: organization.id, type: "SETTINGS_CHANGED", message: `Added location "${name}"` },
  });

  return NextResponse.json({ ok: true, location });
}
