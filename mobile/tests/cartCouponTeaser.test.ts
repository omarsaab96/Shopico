import { describe, expect, it } from "vitest";
import { closestCartCoupon, type CartCouponOffer } from "../lib/cartCouponTeaser";

const offer = (overrides: Partial<CartCouponOffer> = {}): CartCouponOffer => ({
  _id: "a", code: "MY800", isPersonal: true, disabled: true, discountType: "FIXED", discount: 800, amountToUnlock: 20, ...overrides,
});

describe("cart coupon teaser", () => {
  it("selects the closest personal discount and prefers more value on a tie", () => {
    const closest = offer({ _id: "closest", discount: 900 });
    expect(closestCartCoupon([offer({ amountToUnlock: 50 }), offer(), closest])).toBe(closest);
  });
  it.each([
    { isPersonal: false }, { disabled: false }, { freeDelivery: true }, { discountType: "PERCENT" },
    { amountToUnlock: 0 }, { amountToUnlock: -20 }, { amountToUnlock: NaN }, { discount: Infinity },
  ])("omits coupons that cannot support the teaser: %j", overrides => {
    expect(closestCartCoupon([offer(overrides)])).toBeNull();
  });
  it("hides when the coupon becomes usable as the cart grows", () => {
    expect(closestCartCoupon([offer()])?.amountToUnlock).toBe(20);
    expect(closestCartCoupon([offer({ amountToUnlock: 0, disabled: false })])).toBeNull();
  });
});
