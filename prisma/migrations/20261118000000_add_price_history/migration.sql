-- AlterTable Investment
ALTER TABLE "Investment" ADD COLUMN "priceUpdatedAt" TIMESTAMP(3);

-- CreateTable PriceHistory
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PriceHistory_symbol_date_key" ON "PriceHistory"("symbol", "date");
CREATE INDEX "PriceHistory_symbol_idx" ON "PriceHistory"("symbol");
