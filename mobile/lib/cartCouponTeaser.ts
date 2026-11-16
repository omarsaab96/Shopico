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
