-- AlterTable User : fin du parcours de bienvenue
ALTER TABLE "User" ADD COLUMN "onboardedAt" TIMESTAMP(3);

-- Les comptes existants ne repassent pas par le parcours
UPDATE "User" SET "onboardedAt" = CURRENT_TIMESTAMP;
