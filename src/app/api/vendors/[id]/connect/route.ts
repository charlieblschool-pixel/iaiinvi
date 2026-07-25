import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { encryptVendorPassword } from "@/lib/vendor-credentials";

const schema = z.object({
  portalUrl: z.string().url(),
  portalUsername: z.string().min(1),
  portalPassword: z.string().min(1),
  accountNumber: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { organization } = await requireOrg();
  const { id } = await params;

  const vendor = await prisma.vendor.findFirst({
    where: { id, organizationId: organization.id },
  });
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  await prisma.vendor.update({
    where: { id: vendor.id },
    data: {
      portalUrl: parsed.data.portalUrl,
      portalUsername: parsed.data.portalUsername,
      portalPasswordEncrypted: encryptVendorPassword(parsed.data.portalPassword),
      accountNumber: parsed.data.accountNumber?.trim() || null,
      connectedAt: new Date(),
    },
  });

  await prisma.activityLogEntry.create({
    data: {
      organizationId: organization.id,
      type: "SETTINGS_CHANGED",
      message: `Connected ${vendor.name} account for automated reordering`,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { organization } = await requireOrg();
  const { id } = await params;

  const vendor = await prisma.vendor.findFirst({
    where: { id, organizationId: organization.id },
  });
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  await prisma.vendor.update({
    where: { id: vendor.id },
    data: {
      portalUrl: null,
      portalUsername: null,
      portalPasswordEncrypted: null,
      accountNumber: null,
      connectedAt: null,
    },
  });

  await prisma.activityLogEntry.create({
    data: {
      organizationId: organization.id,
      type: "SETTINGS_CHANGED",
      message: `Disconnected ${vendor.name} account`,
    },
  });

  return NextResponse.json({ ok: true });
}
