import { z } from "zod";

const orderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const createOrderSchema = z.object({
  address: z.string().min(3),
  lat: z.number(),
  lng: z.number(),
  paymentMethod: z.enum(["CASH_ON_DELIVERY", "SHAM_CASH", "BANK_TRANSFER", "WALLET"]),
  notes: z.string().optional(),
  useReward: z.boolean().optional().default(false),
  items: z.array(orderItemSchema).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["PENDING", "PROCESSING", "SHIPPING", "DELIVERED", "CANCELLED"]),
  paymentStatus: z.enum(["PENDING", "CONFIRMED"]).optional(),
});
