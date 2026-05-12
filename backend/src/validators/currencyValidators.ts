import { z } from "zod";

export const currencySchema = z.object({
  symbol: z.object({
    en: z.string().trim().min(1).max(12),
    ar: z.string().trim().max(12).optional(),
  }),
  exchangeRate: z.number().positive(),
  isPrimary: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
