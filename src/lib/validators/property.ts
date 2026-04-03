import { z } from "zod";

export const propertyTypes = ["APARTMENT", "HOUSE", "BUILDING"] as const;
export const ownershipTypes = ["personal", "sci"] as const;

export const createPropertySchema = z.object({
  name: z.string().min(1, "Property name is required"),
  type: z.enum(propertyTypes),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  country: z.string().default("France"),
  ownershipType: z.enum(ownershipTypes).default("personal"),
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
