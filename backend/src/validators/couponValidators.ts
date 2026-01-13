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
  restricted: z.boolean().optional(),
  expiresAt: z.coerce.date().optional(),
  assignedUsers: z.array(z.string()).optional().nullable(),
  assignedProducts: z.array(z.string()).optional().nullable(),
  assignedMembershipLevels: z.array(z.string()).optional().nullable(),
  usageType: z.enum(["SINGLE", "MULTIPLE"]).optional(),
  maxUses: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
}).superRefine((value, ctx) => {
  const hasUsers = (value.assignedUsers || []).length > 0;
  const hasProducts = (value.assignedProducts || []).length > 0;
  const hasLevels = (value.assignedMembershipLevels || []).length > 0;
  const total = Number(hasUsers) + Number(hasProducts) + Number(hasLevels);
  if (total > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["assignedUsers"],
      message: "Coupon can be assigned to only one type",
    });
  }
});

export const couponValidateSchema = z.object({
  code: z.string().min(3),
  subtotal: z.number().nonnegative(),
  deliveryFee: z.number().nonnegative().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
      })
    )
    .optional(),
});
