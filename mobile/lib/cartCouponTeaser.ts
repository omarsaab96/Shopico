export type CartCouponOffer = {
  _id: string;
  code: string;
  disabled?: boolean;
  isPersonal?: boolean;
  freeDelivery?: boolean;
  discountType?: string;
  discount: number;
  amountToUnlock: number;
  requiresEligibleProducts?: boolean;
};

export function closestCartCoupon(coupons: readonly CartCouponOffer[]): CartCouponOffer | null {
  return coupons.filter(coupon => coupon.isPersonal && coupon.disabled && !coupon.freeDelivery
    && coupon.discountType === "FIXED" && Number.isFinite(coupon.amountToUnlock)
    && coupon.amountToUnlock > 0 && Number.isFinite(coupon.discount) && coupon.discount > 0)
    .sort((a, b) => a.amountToUnlock - b.amountToUnlock || b.discount - a.discount || a._id.localeCompare(b._id))[0] ?? null;
}

// Older API builds return the discount and disabled flag, but omit teaser metadata.
// Ownership comes from the personal-coupons endpoint; eligibility still comes from /available.
export function resolveCartCouponOffers(
  available: readonly (Omit<CartCouponOffer, "amountToUnlock"> & { amountToUnlock?: number })[],
  personal: readonly { _id: string; assignedProducts?: unknown[] }[],
  subtotal: number,
): CartCouponOffer[] {
  const owned = new Map(personal.map(coupon => [coupon._id, coupon]));
  return available.map(coupon => {
    const requiresEligibleProducts = coupon.requiresEligibleProducts ?? Boolean(owned.get(coupon._id)?.assignedProducts?.length);
    const shortfall = Number.isFinite(subtotal) && !requiresEligibleProducts
      ? Math.round((coupon.discount - subtotal + Number.EPSILON) * 1e8) / 1e8 : NaN;
    return {
      ...coupon,
      isPersonal: coupon.isPersonal ?? owned.has(coupon._id),
      requiresEligibleProducts,
      amountToUnlock: coupon.amountToUnlock ?? shortfall,
    };
  });
}
