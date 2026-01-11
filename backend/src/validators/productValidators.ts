import { z } from "zod";

export const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().nonnegative(),
  promoPrice: z.number().nonnegative().optional(),
  isPromoted: z.boolean().optional(),
  categories: z.array(z.string().min(1)).optional().default([]),
  images: z
    .array(
      z.object({
        url: z.string().url(),
        fileId: z.string().min(1),
      })
    )
    .optional()
    .default([]),
  isAvailable: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

export const productUpdateSchema = productSchema.partial();

export const bulkPriceSchema = z.object({
  mode: z.enum(["INCREASE", "DISCOUNT"]),
  amountType: z.enum(["FIXED", "PERCENT"]),
  amount: z.number().positive(),
});
