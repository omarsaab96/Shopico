import { describe, expect, it } from "vitest";
import { closestCartCoupon, resolveCartCouponOffers, type CartCouponOffer } from "../lib/cartCouponTeaser";

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

describe("cart coupon teaser with existing API responses", () => {
  const legacy = { _id: "personal", code: "MY800", discount: 800, discountType: "FIXED", disabled: true };
  it("shows the 20 shortfall without requiring new backend metadata", () => {
    const offers = resolveCartCouponOffers([legacy], [{ _id: "personal" }], 780);
    expect(closestCartCoupon(offers)).toMatchObject({ code: "MY800", amountToUnlock: 20, discount: 800, isPersonal: true });
  });
  it("does not advertise public coupons as belonging to the user", () => {
    expect(closestCartCoupon(resolveCartCouponOffers([legacy], [], 780))).toBeNull();
  });
  it("uses server-calculated eligibility amounts when provided", () => {
    const offers = resolveCartCouponOffers([{ ...legacy, isPersonal: true, amountToUnlock: 60, requiresEligibleProducts: true }], [], 780);
    expect(closestCartCoupon(offers)?.amountToUnlock).toBe(60);
  });
  it("does not guess shortfalls for product-restricted coupons", () => {
    const offers = resolveCartCouponOffers([legacy], [{ _id: "personal", assignedProducts: ["product"] }], 780);
    expect(closestCartCoupon(offers)).toBeNull();
  });
  it("hides the teaser once the coupon value is covered", () => {
    expect(closestCartCoupon(resolveCartCouponOffers([legacy], [{ _id: "personal" }], 800))).toBeNull();
  });
});
