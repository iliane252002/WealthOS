-- LeaseCoTenant: co-tenants on a single lease (colocation)
CREATE TABLE "LeaseCoTenant" (
    "id"       TEXT NOT NULL PRIMARY KEY,
    "leaseId"  TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "LeaseCoTenant_leaseId_fkey"  FOREIGN KEY ("leaseId")  REFERENCES "Lease"("id")  ON DELETE CASCADE,
    CONSTRAINT "LeaseCoTenant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
);
CREATE UNIQUE INDEX "LeaseCoTenant_leaseId_tenantId_key" ON "LeaseCoTenant"("leaseId","tenantId");
CREATE INDEX "LeaseCoTenant_leaseId_idx" ON "LeaseCoTenant"("leaseId");

-- Loan: mortgage / crédit immobilier par bien
CREATE TABLE "Loan" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "userId"         TEXT NOT NULL,
    "propertyId"     TEXT NOT NULL,
    "lenderName"     TEXT,
    "originalAmount" DOUBLE PRECISION NOT NULL,
    "interestRate"   DOUBLE PRECISION NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "startDate"      TEXT NOT NULL,
    "monthlyPayment" DOUBLE PRECISION,
    "notes"          TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Loan_userId_fkey"     FOREIGN KEY ("userId")     REFERENCES "User"("id"),
    CONSTRAINT "Loan_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE
);
CREATE INDEX "Loan_userId_idx"     ON "Loan"("userId");
CREATE INDEX "Loan_propertyId_idx" ON "Loan"("propertyId");
