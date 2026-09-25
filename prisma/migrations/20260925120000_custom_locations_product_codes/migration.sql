-- Locations become free-form names with a display order.
ALTER TABLE "Location" ALTER COLUMN "type" DROP NOT NULL;
ALTER TABLE "Location" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Product codes, brand, vendor SKU.
ALTER TABLE "Organization" ADD COLUMN "nextProductNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Product" ADD COLUMN "code" TEXT;
ALTER TABLE "Product" ADD COLUMN "brand" TEXT;
ALTER TABLE "Product" ADD COLUMN "sku" TEXT;

-- Backfill codes for existing products in creation order (cuids sort by time).
WITH numbered AS (
  SELECT "id", "organizationId",
         ROW_NUMBER() OVER (PARTITION BY "organizationId" ORDER BY "id") AS n
  FROM "Product"
)
UPDATE "Product" p
SET "code" = 'P-' || LPAD(numbered.n::text, 4, '0')
FROM numbered
WHERE p."id" = numbered."id";

UPDATE "Organization" o
SET "nextProductNumber" = COALESCE(
  (SELECT COUNT(*) + 1 FROM "Product" p WHERE p."organizationId" = o."id"), 1);

ALTER TABLE "Product" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "Product_organizationId_code_key" ON "Product"("organizationId", "code");
