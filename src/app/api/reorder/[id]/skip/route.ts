import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { organization } = await requireOrg();
  const { id } = await params;

  const suggestion = await prisma.reorderSuggestion.findFirst({
    where: { id, organizationId: organization.id, status: "PENDING" },
    include: { product: true },
  });
  if (!suggestion) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.reorderSuggestion.update({
      where: { id },
      data: { status: "SKIPPED", resolvedAt: new Date() },
    }),
    prisma.activityLogEntry.create({
      data: {
        organizationId: organization.id,
        type: "SUGGESTION_SKIPPED",
        message: `Skipped reorder suggestion for ${suggestion.product.name}`,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
