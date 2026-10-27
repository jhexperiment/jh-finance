-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(28,8);
ALTER TABLE "Transaction" ADD COLUMN "asset" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "externalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_accountId_externalId_key" ON "Transaction"("accountId", "externalId");

-- CreateTable
CREATE TABLE "ChainAddress" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChainAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChainAddress_accountId_chain_address_key" ON "ChainAddress"("accountId", "chain", "address");

-- CreateIndex
CREATE INDEX "ChainAddress_accountId_idx" ON "ChainAddress"("accountId");

-- AddForeignKey
ALTER TABLE "ChainAddress" ADD CONSTRAINT "ChainAddress_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
