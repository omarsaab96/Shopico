import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

export const couponSchema = z.object({
  code: z.string().min(3).max(32),
  title: optionalText,
  description: optionalText,
  discountType: z.enum(["PERCENT", "FIXED"]),
  discountValue: z.number().nonnegative(),
  freeDelivery: z.boolean().optional(),
  expiresAt: z.coerce.date().optional(),
  assignedUsers: z.array(z.string()).optional().nullable(),
  usageType: z.enum(["SINGLE", "MULTIPLE"]).optional(),
  maxUses: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

export const couponValidateSchema = z.object({
  code: z.string().min(3),
  subtotal: z.number().nonnegative(),
  deliveryFee: z.number().nonnegative().optional(),
});
