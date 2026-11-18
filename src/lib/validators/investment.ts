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

/**
 * Ajout d'une position. Deux façons de la saisir :
 * - simple : un montant (en euros) et une date ; quantité et prix sont déduits du cours ce jour-là ;
 * - avancée : quantité et prix d'achat.
 */
export const newPositionSchema = z
  .object({
    name: z.string().min(1, "Le nom est obligatoire"),
    assetType: z.enum(assetTypes),
    ticker: z.string().optional(),
    amount: z.number().positive("Le montant doit être positif").optional(),
    quantity: z.number().positive().optional(),
    buyPrice: z.number().positive().optional(),
    currentPrice: z.number().positive().optional(),
    currency: z.string().default("EUR"),
    broker: z.string().optional(),
    accountName: z.string().optional(),
    purchaseDate: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((d) => d.amount !== undefined || d.buyPrice !== undefined, {
    message: "Indiquez un montant, ou une quantité et un prix",
    path: ["amount"],
  });

export type NewPositionInput = z.input<typeof newPositionSchema>;
