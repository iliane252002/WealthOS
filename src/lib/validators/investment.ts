import { z } from "zod";

export const assetTypes = [
  "STOCK", "ETF", "BOND", "CRYPTO", "FUND",
  "SAVINGS_ACCOUNT", "LIFE_INSURANCE", "OTHER",
] as const;

export const createInvestmentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  assetType: z.enum(assetTypes),
  ticker: z.string().optional(),
  quantity: z.number().positive().optional(),
  buyPrice: z.number().positive("Buy price must be positive"),
  currentPrice: z.number().positive().optional(),
  currency: z.string(),
  broker: z.string().optional(),
  accountName: z.string().optional(),
  purchaseDate: z.string().optional(),
  notes: z.string().optional(),
});

export const updateInvestmentSchema = createInvestmentSchema.partial();

export type CreateInvestmentInput = z.infer<typeof createInvestmentSchema>;
export type UpdateInvestmentInput = z.infer<typeof updateInvestmentSchema>;
