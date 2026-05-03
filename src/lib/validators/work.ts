import { z } from "zod";

export const workStatuses = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

export const createWorkSchema = z.object({
  propertyId: z.string().optional(),
  lotId: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  contractor: z.string().optional(),
  cost: z.number().positive().optional(),
  status: z.enum(workStatuses),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isTaxDeductible: z.boolean(),
  taxCategory: z.string().optional(),
});

export const updateWorkSchema = createWorkSchema.partial();

export type CreateWorkInput = z.infer<typeof createWorkSchema>;
export type UpdateWorkInput = z.infer<typeof updateWorkSchema>;
