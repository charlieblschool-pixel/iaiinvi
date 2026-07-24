import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";

const schema = z.object({ name: z.string().min(1) });

export async function PATCH(request: Request) {
  const { organization } = await requireOrg();
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  await prisma.organization.update({
    where: { id: organization.id },
    data: { name: parsed.data.name },
  });

  return NextResponse.json({ ok: true });
}
