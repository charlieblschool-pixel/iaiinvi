import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { ACTIVITY_LABELS, ACTIVITY_TONES } from "@/lib/activity";
import { Badge } from "@/components/ui/badge";

export default async function ActivityLogPage() {
  const { organization } = await requireOrg();

  const entries = await prisma.activityLogEntry.findMany({
    where: { organizationId: organization.id },
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Activity Log</h1>
        <p className="mt-1 text-foreground-muted">
          Every stock change, approval, skip, and auto-charge — timestamped
          and attributed.
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-border-hairline bg-surface px-6 py-16 text-center">
          <p className="text-foreground-muted">
            Nothing has happened yet — activity shows up here as stock moves.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border-hairline bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-foreground-muted">
                <th className="px-6 py-3 font-medium">When</th>
                <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium">Details</th>
                <th className="px-6 py-3 font-medium">By</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t border-border-hairline">
                  <td className="whitespace-nowrap px-6 py-3 text-foreground-muted">
                    {entry.createdAt.toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="whitespace-nowrap px-6 py-3">
                    <Badge tone={ACTIVITY_TONES[entry.type]}>
                      {ACTIVITY_LABELS[entry.type]}
                    </Badge>
                  </td>
                  <td className="px-6 py-3">{entry.message}</td>
                  <td className="whitespace-nowrap px-6 py-3 text-foreground-muted">
                    {entry.user?.name ?? "System"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
