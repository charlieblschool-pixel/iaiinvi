import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/session";
import { generateWeeklyInvoice } from "@/lib/invoices";

export async function POST() {
  const { organization } = await requireOrg();
  const invoice = await generateWeeklyInvoice(organization.id);

  if (!invoice) {
    return NextResponse.json({
      ok: true,
      created: false,
      message: "Nothing to invoice for last week yet.",
    });
  }

  return NextResponse.json({ ok: true, created: true, invoice });
}
