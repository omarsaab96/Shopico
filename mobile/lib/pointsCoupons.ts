export type CouponFilter = "all" | "points" | "discount" | "delivery" | "usable";
export type CouponDateOrder = "newest" | "oldest";

type Coupon = { _id: string; createdAt?: string; rewardToken?: string; freeDelivery?: boolean };

function createdTime(coupon: Coupon): number {
  const date = coupon.createdAt ? Date.parse(coupon.createdAt) : NaN;
  if (Number.isFinite(date)) return date;
  // Older responses may omit createdAt; MongoDB IDs also contain creation time.
  return /^[a-f\d]{24}$/i.test(coupon._id) ? parseInt(coupon._id.slice(0, 8), 16) * 1000 : 0;
}

export function selectPointsCoupons<T extends Coupon>(
  coupons: readonly T[], filter: CouponFilter, order: CouponDateOrder, isUsable: (coupon: T) => boolean,
): T[] {
  const direction = order === "newest" ? -1 : 1;
  return coupons.filter(coupon => {
    switch (filter) {
      case "points": return Boolean(coupon.rewardToken);
      case "discount": return !coupon.freeDelivery;
      case "delivery": return Boolean(coupon.freeDelivery);
      case "usable": return isUsable(coupon);
      default: return true;
    }
  }).sort((a, b) => direction * (createdTime(a) - createdTime(b) || a._id.localeCompare(b._id)));
}
