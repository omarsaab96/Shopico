import { describe, expect, it } from "vitest";
import { selectPointsCoupons } from "../lib/pointsCoupons";

const coupons = [
  { _id: "older", createdAt: "2026-11-01T12:00:00Z", rewardToken: "reward", freeDelivery: false },
  { _id: "newer", createdAt: "2026-11-03T12:00:00Z", freeDelivery: false },
  { _id: "middle", createdAt: "2026-11-02T12:00:00Z", freeDelivery: true },
];
const usable = (coupon: { _id: string }) => coupon._id !== "newer";

describe("points coupon ordering and filters", () => {
  it("keeps newest coupons first even when they cannot be used in the current cart", () => {
    expect(selectPointsCoupons(coupons, "all", "newest", usable).map(c => c._id)).toEqual(["newer", "middle", "older"]);
    expect(selectPointsCoupons(coupons, "all", "oldest", usable).map(c => c._id)).toEqual(["older", "middle", "newer"]);
    expect(coupons.map(c => c._id)).toEqual(["older", "newer", "middle"]);
  });

  it("filters by points rewards, discounts, free delivery and usability", () => {
    expect(selectPointsCoupons(coupons, "points", "newest", usable).map(c => c._id)).toEqual(["older"]);
    expect(selectPointsCoupons(coupons, "discount", "newest", usable).map(c => c._id)).toEqual(["newer", "older"]);
    expect(selectPointsCoupons(coupons, "delivery", "newest", usable).map(c => c._id)).toEqual(["middle"]);
    expect(selectPointsCoupons(coupons, "usable", "newest", usable).map(c => c._id)).toEqual(["middle", "older"]);
    expect(selectPointsCoupons(coupons, "usable", "newest", () => false)).toEqual([]);
  });

  it("handles missing dates and breaks equal-date ties consistently", () => {
    const input = [{ _id: "650000000000000000000002" }, { _id: "660000000000000000000001" }, { _id: "650000000000000000000001" }];
    expect(selectPointsCoupons(input, "all", "newest", () => true).map(c => c._id)).toEqual([input[1]._id, input[0]._id, input[2]._id]);
  });
});
