import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email";

const bodySchema = z.object({ email: z.string().email() });

const RESET_TOKEN_TTL_HOURS = 1;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    // Always return ok — don't leak whether the input was even well-formed.
    return NextResponse.json({ ok: true });
  }
  const { email } = parsed.data;

  const allowedByIp = await checkRateLimit(`forgot:ip:${ip}`, 10, 60);
  const allowedByEmail = await checkRateLimit(`forgot:email:${email.toLowerCase()}`, 3, 60);
  if (!allowedByIp || !allowedByEmail) {
    return NextResponse.json({ ok: true });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Only password-auth accounts can reset — OAuth-only accounts have no
  // passwordHash to change. Respond identically either way so the endpoint
  // can't be used to enumerate accounts.
  if (user?.passwordHash) {
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.verificationToken.create({
      data: {
        identifier: `reset:${email}`,
        token,
        expires: new Date(Date.now() + RESET_TOKEN_TTL_HOURS * 60 * 60 * 1000),
      },
    });
    const origin = new URL(request.url).origin;
    const resetUrl = `${origin}/reset-password?email=${encodeURIComponent(email)}&token=${token}`;
    await sendPasswordResetEmail(email, resetUrl);
  }

  return NextResponse.json({ ok: true });
}
