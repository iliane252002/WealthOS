import { z } from "zod";

export const propertyTypes = ["APARTMENT", "HOUSE", "BUILDING"] as const;
export const ownershipTypes = ["personal", "sci"] as const;

export const createPropertySchema = z.object({
  name: z.string().min(1, "Property name is required"),
  address: z.string().min(1, "Address is required"),
  // Everything else is OPTIONAL
  type: z.enum(propertyTypes).optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  ownershipType: z.enum(ownershipTypes).optional(),
  acquisitionDate: z.string().optional(),
  acquisitionPrice: z.number().positive().optional(),
  currentValue: z.number().positive().optional(),
  surface: z.number().positive().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
});

export const updatePropertySchema = createPropertySchema.partial();

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
