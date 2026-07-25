-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "accountNumber" TEXT,
ADD COLUMN     "connectedAt" TIMESTAMP(3),
ADD COLUMN     "portalPasswordEncrypted" TEXT,
ADD COLUMN     "portalUrl" TEXT,
ADD COLUMN     "portalUsername" TEXT;
