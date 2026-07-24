import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const CONNECTIONS = [
  {
    name: "Booker / MINDBODY",
    description: "Sync sold and used products the moment they happen at checkout.",
  },
  {
    name: "Square",
    description: "Pull sales data straight from your point of sale.",
  },
  {
    name: "Vagaro",
    description: "Connect appointments and retail sales to stock automatically.",
  },
  {
    name: "UNITE",
    description: "Let the reorder engine place backbar orders directly on your account.",
  },
];

export function ConnectionsCard() {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Connections</h2>
        <Badge tone="neutral">Coming soon</Badge>
      </div>
      <p className="mt-1 text-sm text-foreground-muted">
        Full automation is on the way — connect your point-of-sale and
        vendors so stock updates and reorders happen without any manual
        entry. For now, keep using the spreadsheet import and manual stock
        updates below.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {CONNECTIONS.map((c) => (
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
    </Card>
  );
}
