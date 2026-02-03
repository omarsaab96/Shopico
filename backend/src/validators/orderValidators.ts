import { z } from "zod";

const orderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const createOrderSchema = z.object({
  address: z.string().min(3).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  addressId: z.string().optional(),
  paymentMethod: z.enum(["CASH_ON_DELIVERY", "SHAM_CASH", "BANK_TRANSFER", "WALLET"]),
  notes: z.string().optional(),
  useReward: z.boolean().optional().default(false),
  couponCode: z.string().optional(),
  couponCodes: z.array(z.string().min(1)).optional(),
  items: z.array(orderItemSchema).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["PENDING", "PROCESSING", "SHIPPING", "DELIVERED", "CANCELLED"]),
  paymentStatus: z.enum(["PENDING", "CONFIRMED"]).optional(),
});

export const assignDriverSchema = z.object({
  driverId: z.string().min(1),
});

export const driverLocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export const driverStatusSchema = z.object({
  status: z.enum(["SHIPPING", "DELIVERED"]),
});
