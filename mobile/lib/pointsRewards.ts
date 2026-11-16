export type RewardSummary = { rewardCount?: number | string | null; rewardAvailable?: boolean };

export function availableRewardCount(summary: RewardSummary): number | null {
  const raw = summary.rewardCount;
  const count = typeof raw === "number" ? raw
    : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  if (Number.isSafeInteger(count) && count >= 0) return count;
  return summary.rewardAvailable === false ? 0 : null;
}

export function requireRewardCount(summary: RewardSummary): number {
  if (summary.rewardCount === undefined || summary.rewardCount === null) {
    throw new Error("Points summary is missing rewardCount");
  }
  const count = availableRewardCount({ rewardCount: summary.rewardCount });
  if (count === null) throw new Error("Points summary has an invalid rewardCount");
  return count;
}

export type RewardBatch = { requestId: string; remaining: number | null; currencyId?: string };

export async function redeemRewardBatch<T>(
  batch: RewardBatch,
  redeemOne: (requestId: string, currencyId?: string) => Promise<T>,
  fetchSummary: () => Promise<RewardSummary>,
  onCoupon: (coupon: T) => void,
  makeRequestId: () => string,
): Promise<void> {
  while (batch.remaining === null || batch.remaining > 0) {
    const coupon = await redeemOne(batch.requestId, batch.currencyId);
    // Advance only after a confirmed response. An uncertain request must reuse its ID.
    batch.requestId = makeRequestId();
    if (batch.remaining !== null) batch.remaining -= 1;
    onCoupon(coupon);
    if (batch.remaining === null) {
      // Older servers expose only a boolean: keep redeeming until it becomes false.
      const summary = await fetchSummary();
      batch.remaining = availableRewardCount(summary) ?? (summary.rewardAvailable ? null : 0);
    }
  }
}
