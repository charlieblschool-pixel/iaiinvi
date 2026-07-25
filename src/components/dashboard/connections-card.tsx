import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { VendorConnectRow, type VendorConnectionInfo } from "@/components/dashboard/vendor-connect-form";

const POS_CONNECTIONS = [
  {
    name: "Square",
    description: "Pull sales data straight from your point of sale.",
  },
  {
    name: "Vagaro",
    description: "Connect appointments and retail sales to stock automatically.",
  },
];

export function ConnectionsCard({ vendors }: { vendors: VendorConnectionInfo[] }) {
  return (
    <Card className="p-6">
      <h2 className="font-semibold">Connections</h2>
      <p className="mt-1 text-sm text-foreground-muted">
        Sync sales from your point of sale and let the reorder engine fill a
        vendor&rsquo;s cart automatically — you always give the final okay
        before anything is purchased.
      </p>

      <div className="mt-4 flex items-center justify-between rounded-lg border border-border-hairline px-4 py-3">
        <div>
          <span className="text-sm font-medium">Booker / MINDBODY</span>
          <p className="text-xs text-foreground-muted">
            Upload a sales export to deduct sold products from stock.
          </p>
        </div>
        <LinkButton href="/dashboard/inventory/import-sales" variant="secondary" className="text-xs">
          Sync sales
        </LinkButton>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {POS_CONNECTIONS.map((c) => (
          <div
            key={c.name}
            className="flex flex-col gap-1 rounded-lg border border-border-hairline px-4 py-3 opacity-70"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{c.name}</span>
              <Badge tone="neutral" className="text-[10px]">
                Coming soon
              </Badge>
            </div>
            <p className="text-xs text-foreground-muted">{c.description}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-border-hairline pt-5">
        <h3 className="text-sm font-semibold">Vendor accounts</h3>
        <p className="mt-1 text-xs text-foreground-muted">
          Connect a vendor&rsquo;s ordering portal to auto-fill its cart when
          you approve a reorder. UNITE and Color Wow support cart auto-fill
          today — other vendors are stored for account-number lookup, but
          still require placing the order yourself for now.
        </p>
        {vendors.length === 0 ? (
          <p className="mt-3 text-sm text-foreground-muted">
            Add a vendor in the section above first.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {vendors.map((v) => (
              <VendorConnectRow key={v.id} vendor={v} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
