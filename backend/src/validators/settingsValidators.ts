import { z } from "zod";

export const updateSettingsSchema = z.object({
  storeLat: z.number(),
  storeLng: z.number(),
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
  pointsPerAmount: z.number().positive(),
  rewardThresholdPoints: z.number().int().positive(),
  rewardValue: z.number().nonnegative(),
});
