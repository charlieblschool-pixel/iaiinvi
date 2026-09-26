import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOrg } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { usageCategoryFromName } from "@/lib/categories";
import { MOVEMENT_LABELS, MOVEMENT_TYPES, type MovementKind } from "@/lib/tracking";
import { RANGES, parseRange, rangeStart } from "@/lib/tracking-report";
import { UndoMovementButton } from "@/components/dashboard/undo-movement-button";

export const metadata = { title: "Sold & wasted — invii.ai" };

const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });
const TONE: Record<MovementKind, "good" | "neutral" | "bad"> = { SOLD: "good", USED: "neutral", WASTED: "bad" };

export default async function TrackedReportPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { organization } = await requireOrg();
  const range = parseRange((await searchParams).range);
  const since = rangeStart(range);

  const movements = await prisma.stockMovement.findMany({
    where: { organizationId: organization.id, ...(since ? { createdAt: { gte: since } } : {}) },
    include: {
      product: { include: { category: true } },
      location: true,
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const totals = Object.fromEntries(
    MOVEMENT_TYPES.map((t) => {
      const rows = movements.filter((m) => m.type === t);
      return [t, { units: rows.reduce((s, m) => s + m.quantity, 0), value: rows.reduce((s, m) => s + m.quantity * m.unitCost, 0) }];
    }),
  ) as Record<MovementKind, { units: number; value: number }>;
  const allUnits = totals.SOLD.units + totals.USED.units + totals.WASTED.units;
  const wasteRate = allUnits > 0 ? (totals.WASTED.units / allUnits) * 100 : 0;

  type Row = { id: string; code: string; name: string; category: string; SOLD: number; USED: number; WASTED: number; wastedValue: number };
  const byProduct = new Map<string, Row>();
  for (const m of movements) {
    const row =
      byProduct.get(m.productId) ??
      {
        id: m.productId,
        code: m.product.code,
        name: m.product.name,
        category: usageCategoryFromName(m.product.category?.name) ?? m.product.category?.name ?? "—",
        SOLD: 0,
        USED: 0,
        WASTED: 0,
        wastedValue: 0,
      };
    row[m.type] += m.quantity;
    if (m.type === "WASTED") row.wastedValue += m.quantity * m.unitCost;
    byProduct.set(m.productId, row);
  }
  const productRows = [...byProduct.values()].sort(
    (a, b) => b.SOLD + b.USED + b.WASTED - (a.SOLD + a.USED + a.WASTED) || a.name.localeCompare(b.name),
  );
  const LOG_LIMIT = 200;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Date range" className="flex flex-wrap gap-2">
          {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((key) => (
            <Link
              key={key}
              href={`/dashboard/reports/tracked?range=${key}`}
              aria-current={range === key ? "page" : undefined}
              scroll={false}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150 active:scale-95",
                range === key
                  ? "border-brand bg-brand/10 text-brand-light"
                  : "border-border-hairline text-foreground-muted hover:border-white/40 hover:text-foreground",
              )}
            >
              {RANGES[key].label}
            </Link>
          ))}
        </nav>
        <div className="flex gap-2 print:hidden">
          <a
            href={`/api/export/tracked?range=${range}`}
            download
            className="inline-flex h-8 items-center rounded-full border border-border-hairline bg-surface-raised px-3 text-sm font-medium transition-all duration-150 hover:border-white/40 active:scale-[0.97]"
          >
            Download CSV
          </a>
          <LinkButton href="/dashboard/inventory" size="sm">
            Track something
          </LinkButton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {MOVEMENT_TYPES.map((t) => (
          <Card key={t} className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">{MOVEMENT_LABELS[t].label}</p>
            <p className={cn("mt-1 text-2xl font-semibold tabular-nums", t === "WASTED" && totals.WASTED.units > 0 && "text-status-bad")}>
              {totals[t].units.toLocaleString()}
            </p>
            <p className="text-xs text-foreground-muted">
              {money(totals[t].value)} {t === "WASTED" ? "lost at cost" : "at cost"}
            </p>
          </Card>
        ))}
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">Waste rate</p>
          <p className={cn("mt-1 text-2xl font-semibold tabular-nums", wasteRate >= 10 && "text-status-warn")}>
            {wasteRate.toFixed(wasteRate < 10 && wasteRate > 0 ? 1 : 0)}%
          </p>
          <p className="text-xs text-foreground-muted">of everything tracked</p>
        </Card>
      </div>

      {movements.length === 0 ? (
        <Card className="px-6 py-14 text-center">
          <h2 className="font-semibold">Nothing tracked {range === "all" ? "yet" : `in ${RANGES[range].label.toLowerCase()}`}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-foreground-muted">
            On the Inventory page, press <span className="font-medium text-foreground">Track</span> (or the T key), type a
            product or scan its barcode, and choose Sold, Used or Wasted. It shows up here right away.
          </p>
        </Card>
      ) : (
        <>
          <section aria-labelledby="by-product" className="overflow-hidden rounded-2xl border border-border-hairline bg-surface">
            <h2 id="by-product" className="border-b border-border-hairline px-5 py-4 font-semibold">
              By product
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-foreground-muted">
                    <th scope="col" className="px-5 py-3 font-medium">Code</th>
                    <th scope="col" className="px-5 py-3 font-medium">Product</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Sold</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Used</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Wasted</th>
                    <th scope="col" className="px-5 py-3 text-right font-medium">Waste cost</th>
                  </tr>
                </thead>
                <tbody>
                  {productRows.map((r) => (
                    <tr key={r.id} className="border-t border-border-hairline">
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-foreground-muted">{r.code}</td>
                      <td className="px-5 py-3">
                        {r.name}
                        <span className="ml-2 text-xs text-foreground-muted">{r.category}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.SOLD || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.USED || "—"}</td>
                      <td className={cn("px-4 py-3 text-right tabular-nums", r.WASTED > 0 && "text-status-bad")}>{r.WASTED || "—"}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-foreground-muted">
                        {r.wastedValue > 0 ? money(r.wastedValue) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="log" className="overflow-hidden rounded-2xl border border-border-hairline bg-surface">
            <div className="flex items-baseline justify-between border-b border-border-hairline px-5 py-4">
              <h2 id="log" className="font-semibold">Every entry</h2>
              <span className="text-xs text-foreground-muted">
                {movements.length > LOG_LIMIT ? `Latest ${LOG_LIMIT} of ${movements.length} — download CSV for all` : `${movements.length} entries`}
              </span>
            </div>
            <ul className="divide-y divide-border-hairline">
              {movements.slice(0, LOG_LIMIT).map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="flex min-w-0 items-center gap-3">
                    <Badge tone={TONE[m.type]}>{MOVEMENT_LABELS[m.type].label}</Badge>
                    <div className="min-w-0">
                      <p className="truncate">
                        <span className="font-medium tabular-nums">{m.quantity} ×</span> {m.product.name}{" "}
                        <span className="font-mono text-xs text-foreground-muted">{m.product.code}</span>
                      </p>
                      <p className="text-xs text-foreground-muted">
                        {[
                          m.createdAt.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
                          m.location ? `from ${m.location.name}` : null,
                          m.user?.name ?? m.user?.email ?? null,
                          m.note ? `“${m.note}”` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>
                  <UndoMovementButton id={m.id} label={`${m.quantity} × ${m.product.name} ${MOVEMENT_LABELS[m.type].past}`} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
