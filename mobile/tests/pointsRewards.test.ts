import { describe, expect, it, vi } from "vitest";
import { availableRewardCount, requireRewardCount, redeemRewardBatch, type RewardBatch } from "../lib/pointsRewards";

describe("points coupon redemption", () => {
  it("requires an exact count for the points page instead of inferring it from availability", () => {
    expect(requireRewardCount({ rewardCount: 7, rewardAvailable: true })).toBe(7);
    expect(requireRewardCount({ rewardCount: "3" })).toBe(3);
    expect(requireRewardCount({ rewardCount: 0 })).toBe(0);
    expect(() => requireRewardCount({ rewardAvailable: true })).toThrow("missing rewardCount");
    expect(() => requireRewardCount({ rewardCount: -1 })).toThrow("invalid rewardCount");
  });
  it("does not turn a legacy availability flag into a count of one", () => {
    expect(() => requireRewardCount({ rewardAvailable: true })).toThrow("missing rewardCount");
    expect(requireRewardCount({ rewardCount: 4 })).toBe(4);
    expect(availableRewardCount({ rewardAvailable: true })).toBeNull();
    expect(availableRewardCount({ rewardCount: 5 })).toBe(5);
    expect(availableRewardCount({ rewardCount: 0 })).toBe(0);
    expect(availableRewardCount({ rewardCount: -1 })).toBeNull();
    expect(availableRewardCount({ rewardCount: "4", rewardAvailable: true })).toBe(4);
    expect(availableRewardCount({ rewardAvailable: false })).toBe(0);
    expect(availableRewardCount({ rewardCount: null, rewardAvailable: true })).toBeNull();
    expect(availableRewardCount({ rewardCount: "", rewardAvailable: true })).toBeNull();
  });

  it("redeems every reward on a server that only returns availability", async () => {
    const batch: RewardBatch = { requestId: "first", remaining: null };
    const redeem = vi.fn().mockResolvedValueOnce("a").mockResolvedValueOnce("b").mockResolvedValueOnce("c");
    const summary = vi.fn().mockResolvedValueOnce({ rewardAvailable: true }).mockResolvedValueOnce({ rewardAvailable: true }).mockResolvedValueOnce({ rewardAvailable: false });
    const added: string[] = [];
    let id = 0;
    await redeemRewardBatch<string>(batch, redeem, summary, coupon => added.push(coupon), () => `next-${++id}`);
    expect(added).toEqual(["a", "b", "c"]);
    expect(batch.remaining).toBe(0);
    expect(redeem.mock.calls.map(call => call[0])).toEqual(["first", "next-1", "next-2"]);
  });

  it("adds confirmed coupons immediately and retries an interrupted request with the same ID", async () => {
    const batch: RewardBatch = { requestId: "first", remaining: 3, currencyId: "currency" };
    const added: string[] = [];
    const redeem = vi.fn().mockResolvedValueOnce("a").mockRejectedValueOnce(new Error("connection lost"));
    let id = 0;
    const nextId = () => `next-${++id}`;
    const summary = vi.fn();
    await expect(redeemRewardBatch<string>(batch, redeem, summary, coupon => added.push(coupon), nextId)).rejects.toThrow("connection lost");
    expect(added).toEqual(["a"]);
    expect(batch).toMatchObject({ requestId: "next-1", remaining: 2 });
    redeem.mockResolvedValueOnce("b").mockResolvedValueOnce("c");
    await redeemRewardBatch<string>(batch, redeem, summary, coupon => added.push(coupon), nextId);
    expect(added).toEqual(["a", "b", "c"]);
    expect(redeem.mock.calls.map(call => call[0])).toEqual(["first", "next-1", "next-1", "next-2"]);
    expect(summary).not.toHaveBeenCalled();
  });
});
