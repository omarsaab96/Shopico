import { z } from "zod";

export const supportPhoneSchema = z.string().trim().max(40).refine(
  value => value === "" || (/^\+?[0-9 ()-]+$/.test(value) && value.replace(/\D/g, "").length >= 3 && value.replace(/\D/g, "").length <= 15),
  "Enter a valid support phone number"
);

export const updateSettingsSchema = z.object({
  supportPhone: supportPhoneSchema.optional(),
  deliveryFreeKm: z.number().nonnegative(),
  deliveryRatePerKm: z.number().nonnegative(),
  allowMultipleCoupons: z.boolean(),
  membershipGraceDays: z.number().int().nonnegative(),
  membershipThresholds: z.object({
    silver: z.number().nonnegative(),
    gold: z.number().nonnegative(),
    platinum: z.number().nonnegative(),
    diamond: z.number().nonnegative(),
  }),
  membershipThresholdsByCurrency: z.array(z.object({
    currency: z.string().min(1),
    thresholds: z.object({
      silver: z.number().nonnegative(),
      gold: z.number().nonnegative(),
      platinum: z.number().nonnegative(),
      diamond: z.number().nonnegative(),
    }),
  })).optional(),
  pointsPerAmount: z.number().positive(),
  rewardThresholdPoints: z.number().int().positive(),
  rewardValue: z.number().nonnegative(),
});
