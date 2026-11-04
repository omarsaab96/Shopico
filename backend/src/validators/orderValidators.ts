import { z } from "zod";

const orderItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).optional(),
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
  currencyId: z.string().min(1).optional(),
  items: z.array(orderItemSchema).optional(),
});

export const deliveryEstimateSchema = z.object({
  addressId: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(["PENDING", "PROCESSING", "SHIPPING", "DELIVERED", "CANCELLED"]),
  paymentStatus: z.enum(["PENDING", "CONFIRMED"]).optional(),
  driverId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});

export const updateOrderDetailsSchema = z.object({
  notes: z.string().optional(),
  driverId: z.string().nullable().optional(),
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

export const rateDriverSchema = z.object({
  rating: z.number().int().min(1).max(5),
});

export const refundItemPreviewSchema = z.object({
  itemIndex: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
});

export const refundItemSchema = refundItemPreviewSchema.extend({
  requestId: z.string().uuid(),
  expectedRefundedQuantity: z.number().int().nonnegative(),
  expectedTotal: z.number().nonnegative(),
  expectedAmount: z.number().nonnegative(),
  expectedWalletAmount: z.number().nonnegative(),
  expectedCancelOrder: z.boolean(),
  expectedPaymentStatus: z.enum(["PENDING", "CONFIRMED"]),
});
