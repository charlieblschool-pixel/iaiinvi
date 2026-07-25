import { requireInventoryAccess } from "@/lib/session";
import { ImportForm } from "@/components/dashboard/import-form";

export default async function ImportInventoryPage() {
  await requireInventoryAccess();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Import spreadsheet</h1>
      <p className="mt-1 text-foreground-muted">
        Already track inventory in Excel or Sheets? Bring it in and invii.ai
        will sort products into categories and locations automatically.
      </p>
      <div className="mt-8">
        <ImportForm />
      </div>
    </div>
  );
}
