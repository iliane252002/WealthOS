-- CreateTable InvestmentTransaction
CREATE TABLE "InvestmentTransaction" (
    "id" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "fees" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InvestmentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvestmentTransaction_investmentId_idx" ON "InvestmentTransaction"("investmentId");

-- AddForeignKey
ALTER TABLE "InvestmentTransaction" ADD CONSTRAINT "InvestmentTransaction_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reprise des positions existantes : un achat initial par position
INSERT INTO "InvestmentTransaction" ("id", "investmentId", "type", "date", "quantity", "price", "fees", "createdAt", "updatedAt")
SELECT
    'mig_' || "id",
    "id",
    'BUY',
    CASE WHEN "purchaseDate" ~ '^\d{4}-\d{2}-\d{2}$' THEN "purchaseDate" ELSE to_char("createdAt", 'YYYY-MM-DD') END,
    COALESCE("quantity", 1),
    "buyPrice",
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Investment";

UPDATE "Investment"
SET "purchaseDate" = to_char("createdAt", 'YYYY-MM-DD')
WHERE "purchaseDate" IS NULL OR "purchaseDate" !~ '^\d{4}-\d{2}-\d{2}$';
