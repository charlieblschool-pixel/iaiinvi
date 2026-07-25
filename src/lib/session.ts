import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasInventoryAccess } from "@/lib/billing";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session;
}

export async function requireOrg() {
  const session = await requireSession();

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    redirect("/signup");
  }

  return {
    session,
    membership,
    organization: membership.organization,
  };
}

export async function requireInventoryAccess() {
  const ctx = await requireOrg();

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: ctx.organization.id },
  });

  if (!hasInventoryAccess(subscription)) {
    redirect("/dashboard/billing?paywall=inventory");
  }

  return { ...ctx, subscription };
}
