import { describe, expect, test } from "vitest";
import { supportPhoneSchema, updateSettingsSchema } from "../validators/settingsValidators";

describe("support phone settings", () => {
  test("accepts formatted phone numbers and clearing the number", () => {
    expect(supportPhoneSchema.parse(" +963 (944) 123-456 ")).toBe("+963 (944) 123-456");
    expect(supportPhoneSchema.parse("")).toBe("");
  });
  test("accepts short hotline numbers", () => {
    expect(supportPhoneSchema.parse("5050")).toBe("5050");
    expect(supportPhoneSchema.parse("123")).toBe("123");
  });
  test("rejects URLs, dial commands, and invalid numbers", () => {
    for (const phone of ["https://example.com", "12", "+963123#123", "123;456", "1234567890123456"]) {
      expect(supportPhoneSchema.safeParse(phone).success).toBe(false);
    }
  });
  test("existing settings updates may omit the support number", () => {
    const payload = { deliveryFreeKm: 1, deliveryRatePerKm: 0, allowMultipleCoupons: false, membershipGraceDays: 14, membershipThresholds: { silver: 1, gold: 2, platinum: 3, diamond: 4 }, pointsPerAmount: 1, rewardThresholdPoints: 1, rewardValue: 0 };
    expect(updateSettingsSchema.safeParse(payload).success).toBe(true);
    expect(updateSettingsSchema.parse({ ...payload, supportPhone: "+963944123456" }).supportPhone).toBe("+963944123456");
  });
});
