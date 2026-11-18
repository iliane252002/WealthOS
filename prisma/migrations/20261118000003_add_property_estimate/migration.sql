-- AlterTable Property : estimation automatique de la valeur
ALTER TABLE "Property" ADD COLUMN "estimatedValue" DOUBLE PRECISION;
ALTER TABLE "Property" ADD COLUMN "estimatedPricePerM2" DOUBLE PRECISION;
ALTER TABLE "Property" ADD COLUMN "estimateDetails" TEXT;
ALTER TABLE "Property" ADD COLUMN "estimatedAt" TIMESTAMP(3);
