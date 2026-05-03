import { z } from "zod";

export const utilityTypes = ["WATER", "ELECTRICITY", "GAS", "OTHER"] as const;

export const createUtilitySchema = z.object({
  lotId: z.string().min(1),
  type: z.enum(utilityTypes),
  period: z.string().min(1, "Period is required"), // YYYY-MM
  consumption: z.number().optional(),
  cost: z.number().optional(),
  unit: z.string().optional(),
  notes: z.string().optional(),
});

export const updateUtilitySchema = createUtilitySchema.partial().omit({ lotId: true });

export type CreateUtilityInput = z.infer<typeof createUtilitySchema>;
export type UpdateUtilityInput = z.infer<typeof updateUtilitySchema>;
