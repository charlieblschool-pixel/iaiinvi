import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { NewProductForm } from "@/components/dashboard/new-product-form";

export default async function NewProductPage() {
  const { organization } = await requireOrg();

  const [locations, vendors, categories] = await Promise.all([
    prisma.location.findMany({
      where: { organizationId: organization.id },
      orderBy: { name: "asc" },
    }),
    prisma.vendor.findMany({
      where: { organizationId: organization.id },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { organizationId: organization.id },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold">Add product</h1>
      <p className="mt-1 text-foreground-muted">
        Set an initial location and stock count — you can add more locations
        later.
      </p>
      <NewProductForm locations={locations} vendors={vendors} categories={categories} />
    </div>
  );
}
