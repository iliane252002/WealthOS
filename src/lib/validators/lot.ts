import { z } from "zod";

export const createLotSchema = z.object({
  propertyId: z.string().min(1),
  label: z.string().min(1, "Lot label is required"),
  surface: z.number().positive().optional(),
  rooms: z.number().int().positive().optional(),
  floor: z.number().int().optional(),
  description: z.string().optional(),
});

export const updateLotSchema = createLotSchema.partial().omit({ propertyId: true });

export type CreateLotInput = z.infer<typeof createLotSchema>;
export type UpdateLotInput = z.infer<typeof updateLotSchema>;
