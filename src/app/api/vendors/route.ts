import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";

const schema = z.object({
  name: z.string().min(1),
  leadTimeDays: z.coerce.number().int().min(1),
});

export async function POST(request: Request) {
  const { organization } = await requireOrg();
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const vendor = await prisma.vendor.create({
    data: {
      name: parsed.data.name,
      leadTimeDays: parsed.data.leadTimeDays,
      organizationId: organization.id,
    },
  });

  await prisma.activityLogEntry.create({
    data: {
      organizationId: organization.id,
      type: "SETTINGS_CHANGED",
      message: `Added vendor ${vendor.name} (${vendor.leadTimeDays}-day lead time)`,
    },
  });

  return NextResponse.json({ ok: true, vendor });
}
