import { z } from "zod";

export const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const updateCartSchema = z.object({
  items: z.array(cartItemSchema),
});
