import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";

const patchSchema = z.object({
  autoReorder: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { organization } = await requireOrg();
  const { id } = await params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const product = await prisma.product.findFirst({
    where: { id, organizationId: organization.id },
  });
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.product.update({
    where: { id },
    data: parsed.data,
  });

  if (parsed.data.autoReorder !== undefined) {
    await prisma.activityLogEntry.create({
      data: {
        organizationId: organization.id,
        type: "SETTINGS_CHANGED",
        message: `Auto-reorder ${parsed.data.autoReorder ? "enabled" : "disabled"} for ${product.name}`,
      },
    });
  }

  return NextResponse.json({ ok: true, product: updated });
}
