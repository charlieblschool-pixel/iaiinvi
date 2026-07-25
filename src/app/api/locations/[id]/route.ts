import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";

const schema = z.object({
  name: z.string().min(1).max(60),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { organization } = await requireOrg();
  const { id } = await params;

  const location = await prisma.location.findFirst({
    where: { id, organizationId: organization.id },
  });
  if (!location) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid name" },
      { status: 400 },
    );
  }

  const updated = await prisma.location.update({
    where: { id: location.id },
    data: { name: parsed.data.name.trim() },
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
