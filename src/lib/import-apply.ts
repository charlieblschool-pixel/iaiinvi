import { prisma } from "@/lib/prisma";
import { planImport, resolveLocation, type ImportProduct } from "@/lib/import-plan";
import { reserveProductCodes } from "@/lib/product-codes";
import { USAGE_CATEGORIES } from "@/lib/categories";

const DEFAULT_LEAD_TIME_DAYS = 7;

export type ImportOutcome = {
  created: number;
  updated: number;
  locationsCreated: string[];
  firstNewCode: string | null;
  lastNewCode: string | null;
};

/**
 * Writes a spreadsheet import in a single transaction: creates any new
 * locations, vendors and products (with fresh codes), updates matched
 * products, and sets stock per location. Bulk statements keep a 2,000-row
 * sheet to a handful of round trips.
 */
export async function applyImport(
  organizationId: string,
  rows: ImportProduct[],
): Promise<ImportOutcome> {
  return prisma.$transaction(
    async (tx) => {
      const [locations, products, vendors] = await Promise.all([
        tx.location.findMany({ where: { organizationId } }),
        tx.product.findMany({
          where: { organizationId },
          select: { id: true, code: true, name: true, sku: true, category: { select: { name: true } } },
        }),
        tx.vendor.findMany({ where: { organizationId } }),
      ]);

      const plan = planImport(rows, {
        locations,
        products: products.map((p) => ({ ...p, categoryName: p.category?.name ?? null })),
      });

      // ----- Locations -----
      const maxSort = locations.reduce((m, l) => Math.max(m, l.sortOrder), 0);
      const newLocations = plan.locations.filter((l) => l.isNew);
      const createdLocations = newLocations.length
        ? await tx.location.createManyAndReturn({
            data: newLocations.map((l, i) => ({
              name: l.name,
              organizationId,
              sortOrder: maxSort + i + 1,
            })),
          })
        : [];
      const locationIdByName = new Map<string, string>();
      for (const l of locations) locationIdByName.set(l.name, l.id);
      for (const l of createdLocations) locationIdByName.set(l.name, l.id);
      const locationId = (label: string) => {
        const resolved = resolveLocation(plan, label);
        return resolved ? locationIdByName.get(resolved.name) : undefined;
      };

      // ----- Categories (Backbar / Retail) -----
      const categoryIdByName = new Map<string, string>();
      for (const name of USAGE_CATEGORIES) {
        if (!rows.some((r) => r.category === name)) continue;
        const existing = await tx.category.findFirst({
          where: { organizationId, name: { equals: name, mode: "insensitive" } },
        });
        const category =
          existing ?? (await tx.category.create({ data: { name, organizationId } }));
        categoryIdByName.set(name, category.id);
      }

      // ----- Vendors -----
      const vendorIdByKey = new Map(vendors.map((v) => [v.name.trim().toLowerCase(), v.id]));
      const newVendorNames = new Map<string, string>();
      for (const row of rows) {
        const name = row.vendor?.trim();
        if (name && !vendorIdByKey.has(name.toLowerCase())) newVendorNames.set(name.toLowerCase(), name);
      }
      if (newVendorNames.size) {
        const created = await tx.vendor.createManyAndReturn({
          data: Array.from(newVendorNames.values()).map((name) => ({
            name,
            leadTimeDays: DEFAULT_LEAD_TIME_DAYS,
            organizationId,
          })),
        });
        for (const v of created) vendorIdByKey.set(v.name.trim().toLowerCase(), v.id);
      }
      const vendorId = (name?: string) => (name?.trim() ? vendorIdByKey.get(name.trim().toLowerCase()) : undefined);

      // ----- New products -----
      const createIdx = plan.products.flatMap((p, i) => (p.action === "create" ? [i] : []));
      const codes = await reserveProductCodes(tx, organizationId, createIdx.length);
      const productIdByRow = new Map<number, string>();
      if (createIdx.length) {
        const created = await tx.product.createManyAndReturn({
          data: createIdx.map((i, n) => {
            const row = rows[i];
            return {
              organizationId,
              code: codes[n],
              name: row.name,
              brand: row.brand || null,
              sku: row.sku || null,
              unitLabel: row.unit || "unit",
              casePackSize: row.casePackSize ?? 1,
              unitCost: row.unitCost ?? 0,
              categoryId: row.category ? categoryIdByName.get(row.category) : null,
              vendorId: vendorId(row.vendor) ?? null,
            };
          }),
          select: { id: true, code: true },
        });
        const idByCode = new Map(created.map((p) => [p.code, p.id]));
        createIdx.forEach((i, n) => productIdByRow.set(i, idByCode.get(codes[n])!));
      }

      // ----- Updated products (one bulk UPDATE; null means "leave as is") -----
      const updateIdx = plan.products.flatMap((p, i) => (p.action === "update" ? [i] : []));
      if (updateIdx.length) {
        const ids: string[] = [];
        const names: (string | null)[] = [];
        const categoryIds: (string | null)[] = [];
        const brands: (string | null)[] = [];
        const skus: (string | null)[] = [];
        const units: (string | null)[] = [];
        const casePacks: (number | null)[] = [];
        const costs: (number | null)[] = [];
        const vendorIds: (string | null)[] = [];
        for (const i of updateIdx) {
          const row = rows[i];
          const p = plan.products[i];
          productIdByRow.set(i, p.existingId!);
          ids.push(p.existingId!);
          names.push(p.rename ?? null);
          categoryIds.push(row.category ? categoryIdByName.get(row.category) ?? null : null);
          brands.push(row.brand || null);
          skus.push(row.sku || null);
          units.push(row.unit || null);
          casePacks.push(row.casePackSize ?? null);
          costs.push(row.unitCost ?? null);
          vendorIds.push(vendorId(row.vendor) ?? null);
        }
        await tx.$executeRaw`
          UPDATE "Product" AS p SET
            "name"         = COALESCE(v.name, p."name"),
            "categoryId"   = COALESCE(v.category_id, p."categoryId"),
            "brand"        = COALESCE(v.brand, p."brand"),
            "sku"          = COALESCE(v.sku, p."sku"),
            "unitLabel"    = COALESCE(v.unit, p."unitLabel"),
            "casePackSize" = COALESCE(v.case_pack, p."casePackSize"),
            "unitCost"     = COALESCE(v.cost, p."unitCost"),
            "vendorId"     = COALESCE(v.vendor_id, p."vendorId")
          FROM unnest(
            ${ids}::text[], ${names}::text[], ${categoryIds}::text[], ${brands}::text[],
            ${skus}::text[], ${units}::text[], ${casePacks}::int[], ${costs}::float8[], ${vendorIds}::text[]
          ) AS v(id, name, category_id, brand, sku, unit, case_pack, cost, vendor_id)
          WHERE p."id" = v.id AND p."organizationId" = ${organizationId}`;
      }

      // ----- Stock levels -----
      const touchedIds = Array.from(new Set(updateIdx.map((i) => productIdByRow.get(i)!)));
      const existingStock = touchedIds.length
        ? await tx.stockLevel.findMany({
            where: { productId: { in: touchedIds } },
            select: { id: true, productId: true, locationId: true },
          })
        : [];
      const stockIdByPair = new Map(existingStock.map((s) => [`${s.productId}|${s.locationId}`, s.id]));

      const toCreate = new Map<string, { productId: string; locationId: string; onHand: number; reorderPoint: number }>();
      const toUpdate = new Map<string, { onHand: number | null; reorderPoint: number | null }>();
      rows.forEach((row, i) => {
        const productId = productIdByRow.get(i);
        if (!productId) return;
        for (const stock of row.stocks) {
          const locId = locationId(stock.location);
          if (!locId) continue;
          const pair = `${productId}|${locId}`;
          const existingId = stockIdByPair.get(pair);
          if (existingId) {
            if (stock.onHand === undefined && stock.reorderPoint === undefined) continue;
            const prev = toUpdate.get(existingId);
            toUpdate.set(existingId, {
              onHand: stock.onHand ?? prev?.onHand ?? null,
              reorderPoint: stock.reorderPoint ?? prev?.reorderPoint ?? null,
            });
          } else {
            const prev = toCreate.get(pair);
            toCreate.set(pair, {
              productId,
              locationId: locId,
              onHand: stock.onHand ?? prev?.onHand ?? 0,
              reorderPoint: stock.reorderPoint ?? prev?.reorderPoint ?? 0,
            });
          }
        }
      });

      if (toCreate.size) {
        await tx.stockLevel.createMany({ data: Array.from(toCreate.values()), skipDuplicates: true });
      }
      if (toUpdate.size) {
        const ids = Array.from(toUpdate.keys());
        const onHands = ids.map((id) => toUpdate.get(id)!.onHand);
        const reorderPoints = ids.map((id) => toUpdate.get(id)!.reorderPoint);
        await tx.$executeRaw`
          UPDATE "StockLevel" AS s SET
            "onHand"       = COALESCE(v.on_hand, s."onHand"),
            "reorderPoint" = COALESCE(v.reorder_point, s."reorderPoint")
          FROM unnest(${ids}::text[], ${onHands}::int[], ${reorderPoints}::int[])
            AS v(id, on_hand, reorder_point)
          WHERE s."id" = v.id`;
      }

      const created = createIdx.length;
      const updated = updateIdx.length;
      const locationsCreated = createdLocations.map((l) => l.name);
      await tx.activityLogEntry.create({
        data: {
          organizationId,
          type: "STOCK_ADJUSTED",
          message:
            `Imported spreadsheet — ${created} new product${created === 1 ? "" : "s"}, ${updated} updated` +
            (locationsCreated.length
              ? `, ${locationsCreated.length} new location${locationsCreated.length === 1 ? "" : "s"}`
              : ""),
        },
      });

      return {
        created,
        updated,
        locationsCreated,
        firstNewCode: codes[0] ?? null,
        lastNewCode: codes[codes.length - 1] ?? null,
      };
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}
