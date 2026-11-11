import { z } from "zod";

export const cartItemSchema = z.object({
  productId: z.string().min(1),
  unit: z.enum(["piece", "g", "ml"]).optional(),
  variantId: z.string().min(1).optional(),
  quantity: z.number().int().positive(),
});

export const updateCartSchema = z.object({
  items: z.array(cartItemSchema),
});
