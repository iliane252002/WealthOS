import { z } from "zod";

export const transactionTypes = ["BUY", "SELL"] as const;

export const createTransactionSchema = z.object({
  type: z.enum(transactionTypes),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide"),
  quantity: z.number().positive("La quantité doit être positive"),
  price: z.number().positive("Le prix doit être positif"),
  fees: z.number().min(0).default(0),
  notes: z.string().optional(),
});

export const updateTransactionSchema = createTransactionSchema.partial();

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
