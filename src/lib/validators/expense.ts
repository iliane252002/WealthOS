import { z } from "zod";

export const expenseCategories = [
  "INSURANCE", "TAX", "MAINTENANCE", "MANAGEMENT", "CONDO_FEES", "LOAN", "UTILITY", "OTHER",
] as const;

export const expenseFrequencies = ["MONTHLY", "QUARTERLY", "YEARLY"] as const;

export const createExpenseSchema = z.object({
  propertyId: z.string().optional(),
  lotId: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  amount: z.number().positive("Amount must be positive"),
  category: z.enum(expenseCategories),
  isRecurring: z.boolean(),
  frequency: z.enum(expenseFrequencies).optional(),
  date: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
