import { prisma } from "@/lib/prisma";
import { requireInventoryAccess } from "@/lib/session";
import { ImportForm } from "@/components/dashboard/import-form";
import { LOCATION_LABELS } from "@/lib/locations";

export default async function ImportInventoryPage() {
  const { organization } = await requireInventoryAccess();

  const locations = await prisma.location.findMany({
    where: { organizationId: organization.id },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Import spreadsheet</h1>
      <p className="mt-1 text-foreground-muted">
        Already track inventory in Excel or Sheets? Bring it in and invii.ai
        will sort products into categories and locations automatically.
      </p>
      <div className="mt-8">
        <ImportForm
          locations={locations.map((l) => ({
            id: l.id,
            name: l.name !== LOCATION_LABELS[l.type] ? l.name : LOCATION_LABELS[l.type],
            type: l.type,
          }))}
        />
      </div>
    </div>
  );
}
