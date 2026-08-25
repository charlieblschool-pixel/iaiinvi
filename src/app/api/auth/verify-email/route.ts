import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const bodySchema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const allowed = await checkRateLimit(`verify-email:${ip}`, 20, 60);
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { email, token } = parsed.data;

  const identifier = `verify:${email}`;
  const record = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier, token } },
  });

  if (!record || record.expires < new Date()) {
    if (record) {
      await prisma.verificationToken.delete({ where: { identifier_token: { identifier, token } } });
    }
    return NextResponse.json({ error: "This link has expired." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  }

  await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
  await prisma.verificationToken.deleteMany({ where: { identifier } });

  return NextResponse.json({ ok: true });
}
