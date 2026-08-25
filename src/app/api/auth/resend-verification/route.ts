import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/lib/email";

const VERIFY_TOKEN_TTL_HOURS = 24;

export async function POST(request: Request) {
  const session = await requireSession();
  const email = session.user.email;
  if (!email) {
    return NextResponse.json({ error: "No email on this account" }, { status: 400 });
  }

  const allowed = await checkRateLimit(`resend-verify:${email.toLowerCase()}`, 3, 60);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a bit." },
      { status: 429 },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.emailVerified) {
    return NextResponse.json({ ok: true });
  }

  await prisma.verificationToken.deleteMany({ where: { identifier: `verify:${email}` } });
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.verificationToken.create({
    data: {
      identifier: `verify:${email}`,
      token,
      expires: new Date(Date.now() + VERIFY_TOKEN_TTL_HOURS * 60 * 60 * 1000),
    },
  });

  const origin = new URL(request.url).origin;
  const verifyUrl = `${origin}/verify-email?email=${encodeURIComponent(email)}&token=${token}`;
  await sendVerificationEmail(email, verifyUrl);

  return NextResponse.json({ ok: true });
}
