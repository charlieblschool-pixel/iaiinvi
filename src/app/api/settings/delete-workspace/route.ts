import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";

export async function POST() {
  const { organization, membership } = await requireOrg();

  if (membership.role !== "OWNER") {
    return NextResponse.json(
      { error: "Only the workspace owner can delete it." },
      { status: 403 },
    );
  }

  await prisma.organization.delete({ where: { id: organization.id } });

  return NextResponse.json({ ok: true });
}
