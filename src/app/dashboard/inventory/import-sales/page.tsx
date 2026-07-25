import { requireInventoryAccess } from "@/lib/session";
import { BookerSalesImportForm } from "@/components/dashboard/booker-sales-import-form";

export default async function ImportBookerSalesPage() {
  await requireInventoryAccess();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Sync Booker sales</h1>
      <p className="mt-1 text-foreground-muted">
        Upload a product sales export from Booker and invii.ai will deduct
        what sold from stock and recalculate usage rates automatically.
      </p>
      <div className="mt-8">
        <BookerSalesImportForm />
      </div>
    </div>
  );
}
