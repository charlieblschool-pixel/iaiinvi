import { prisma } from "@/lib/prisma";
import { cleanLocationName, findLocationMatch } from "@/lib/locations";

/** Finds a location by name (typo-tolerant) or creates it at the end of the list. */
export async function findOrCreateLocation(organizationId: string, rawName: string) {
  const name = cleanLocationName(rawName);
  if (!name) throw new Error("Location name is required");
  const locations = await prisma.location.findMany({ where: { organizationId } });
  const match = findLocationMatch(name, locations);
  if (match) return match;
  const sortOrder = locations.reduce((m, l) => Math.max(m, l.sortOrder), 0) + 1;
  return prisma.location.create({ data: { name, organizationId, sortOrder } });
}

/** Case-insensitive find-or-create, so "retail" never duplicates "Retail". */
export async function findOrCreateCategory(organizationId: string, rawName: string) {
  const name = rawName.trim();
  const existing = await prisma.category.findFirst({
    where: { organizationId, name: { equals: name, mode: "insensitive" } },
  });
  if (existing) return existing;
  return prisma.category.upsert({
    where: { organizationId_name: { organizationId, name } },
    update: {},
    create: { name, organizationId },
  });
}
