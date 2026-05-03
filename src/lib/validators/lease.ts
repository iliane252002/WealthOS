import { z } from "zod";

export const createLeaseSchema = z.object({
  lotId: z.string().min(1),
  tenantId: z.string().min(1),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  monthlyRent: z.number().positive("Monthly rent must be positive"),
  charges: z.number().min(0),
  deposit: z.number().positive().optional(),
  paymentDayOfMonth: z.number().int().min(1).max(28),
  notifyDaysBefore: z.number().int().min(0).max(30),
});

export const updateLeaseSchema = createLeaseSchema.partial().omit({ lotId: true, tenantId: true });

export type CreateLeaseInput = z.infer<typeof createLeaseSchema>;
export type UpdateLeaseInput = z.infer<typeof updateLeaseSchema>;
