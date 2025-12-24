import { z } from "zod";

export const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  category: z.string().min(1),
  images: z
    .array(
      z.object({
        url: z.string().url(),
        fileId: z.string().min(1),
      })
    )
    .optional()
    .default([]),
  stock: z.number().int().nonnegative().optional(),
  isFeatured: z.boolean().optional(),
});
