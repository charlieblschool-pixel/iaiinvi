import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";

const schema = z.object({ name: z.string().min(1) });

export async function POST(request: Request) {
  const { organization } = await requireOrg();
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const existing = await prisma.category.findUnique({
    where: { organizationId_name: { organizationId: organization.id, name: parsed.data.name } },
  });
  if (existing) {
    return NextResponse.json({ ok: true, category: existing });
  }

  const category = await prisma.category.create({
    data: { name: parsed.data.name, organizationId: organization.id },
  });

  return NextResponse.json({ ok: true, category });
}
