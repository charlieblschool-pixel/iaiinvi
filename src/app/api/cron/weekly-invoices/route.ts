import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateWeeklyInvoice } from "@/lib/invoices";

// Triggered on a schedule (see vercel.json) to roll up last week's reorder
// charges into an invoice per organization. Protected by CRON_SECRET so it
// can't be triggered by anyone who finds the URL.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organizations = await prisma.organization.findMany({ select: { id: true } });
  let generated = 0;
  for (const org of organizations) {
    const invoice = await generateWeeklyInvoice(org.id);
    if (invoice) generated += 1;
  }

  return NextResponse.json({ ok: true, organizationsChecked: organizations.length, generated });
}

export async function GET(request: Request) {
  return POST(request);
}
