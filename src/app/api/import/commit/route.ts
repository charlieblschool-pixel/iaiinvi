import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { hasInventoryAccess } from "@/lib/billing";
import { importProductSchema } from "@/lib/import-plan";
import { applyImport } from "@/lib/import-apply";

export const maxDuration = 60;

const bodySchema = z.object({
  products: z.array(importProductSchema).min(1, "No products to import").max(5000, "That's more than 5,000 products — split the file and import it in parts."),
});

export async function POST(request: Request) {
  const { organization } = await requireOrg();

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: organization.id },
  });
  if (!hasInventoryAccess(subscription)) {
    return NextResponse.json(
      { error: "Your free trial has ended — subscribe to keep importing inventory." },
      { status: 402 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path[0] === "products" && typeof issue.path[1] === "number"
      ? ` (product ${issue.path[1] + 1})`
      : "";
    return NextResponse.json(
      { error: `${issue?.message ?? "Invalid import data"}${where}` },
      { status: 400 },
    );
  }

  try {
    const outcome = await applyImport(organization.id, parsed.data.products);
    return NextResponse.json({ ok: true, ...outcome });
  } catch (err) {
    console.error("Spreadsheet import failed", err);
    return NextResponse.json(
      { error: "The import couldn't be saved, and nothing was changed. Please try again." },
      { status: 500 },
    );
  }
}
