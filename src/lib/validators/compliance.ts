import { z } from "zod";

export const complianceTypes = [
  "LEASE_SIGNED", "DEPOSIT_RECEIVED", "TENANT_INSURANCE",
  "DPE", "GAS_DIAGNOSTIC", "ELECTRICAL_DIAGNOSTIC", "LEAD_DIAGNOSTIC",
  "SMOKE_DETECTOR", "CUSTOM",
] as const;

export const complianceStatuses = ["OK", "MISSING", "EXPIRED", "EXPIRING_SOON"] as const;

export const createComplianceSchema = z.object({
  propertyId: z.string().optional(),
  lotId: z.string().optional(),
  type: z.enum(complianceTypes),
  label: z.string().min(1, "Label is required"),
  status: z.enum(complianceStatuses).default("MISSING"),
  date: z.string().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
  documentUrl: z.string().optional(),
});

export const updateComplianceSchema = createComplianceSchema.partial();

export type CreateComplianceInput = z.infer<typeof createComplianceSchema>;
export type UpdateComplianceInput = z.infer<typeof updateComplianceSchema>;
