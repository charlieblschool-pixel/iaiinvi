import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type Db = typeof prisma | Prisma.TransactionClient;

export function formatProductCode(n: number): string {
  return `P-${String(n).padStart(4, "0")}`;
}

/**
 * Atomically reserves `count` sequential product codes for a workspace.
 * Codes are permanent: they never get reused, even if a product is deleted,
 * so reorder history always points at exactly one product.
 */
export async function reserveProductCodes(
  db: Db,
  organizationId: string,
  count: number,
): Promise<string[]> {
  if (count <= 0) return [];
  const org = await db.organization.update({
    where: { id: organizationId },
    data: { nextProductNumber: { increment: count } },
    select: { nextProductNumber: true },
  });
  const first = org.nextProductNumber - count;
  return Array.from({ length: count }, (_, i) => formatProductCode(first + i));
}
