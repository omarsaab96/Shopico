import { describe, expect, it } from "vitest";
import { updateCartCouponState, type CartCouponState } from "../lib/cartCouponState";
import type { CartCouponOffer } from "../lib/cartCouponTeaser";

const offer: CartCouponOffer = { _id: "coupon-a", code: "MY800", discount: 800, amountToUnlock: 20 };
const state: CartCouponState = { scope: "user:currency", offer, loading: false, presentation: 1 };

describe("shared cart coupon presentation", () => {
  it("does not replay the popup when the same offer is loaded on another page", () => {
    expect(updateCartCouponState(state, state.scope, { ...offer }).presentation).toBe(1);
  });
  it("keeps the presentation when changing cart quantities only changes the shortfall", () => {
    const next = updateCartCouponState({ ...state, loading: true }, state.scope, { ...offer, amountToUnlock: 10 });
    expect(next.presentation).toBe(1);
    expect(next.offer?.amountToUnlock).toBe(10);
    expect(next.loading).toBe(false);
  });
  it("creates a new presentation for a different coupon or account/currency", () => {
    expect(updateCartCouponState(state, state.scope, { ...offer, _id: "coupon-b" }).presentation).toBe(2);
    expect(updateCartCouponState(state, "other-user:currency", offer).presentation).toBe(2);
  });
  it("animates an offer that becomes eligible for a teaser again after disappearing", () => {
    const unlocked = updateCartCouponState(state, state.scope, null);
    expect(unlocked.offer).toBeNull();
    expect(updateCartCouponState(unlocked, state.scope, offer).presentation).toBe(3);
  });
});
