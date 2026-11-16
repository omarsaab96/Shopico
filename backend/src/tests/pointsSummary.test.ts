import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../models/Settings", () => ({ Settings: { findOne: vi.fn() } }));
vi.mock("../models/User", () => ({ User: { findById: vi.fn() } }));
vi.mock("../models/PointsTransaction", () => ({ PointsTransaction: { find: vi.fn() } }));
vi.mock("../models/RewardToken", () => ({ RewardToken: { countDocuments: vi.fn() } }));

import { Types } from "mongoose";
import { Settings } from "../models/Settings";
import { User } from "../models/User";
import { PointsTransaction } from "../models/PointsTransaction";
import { RewardToken } from "../models/RewardToken";
import { getPointsSummary } from "../services/pointsService";

describe("points reward availability", () => {
  beforeEach(() => {
    vi.mocked(Settings.findOne).mockResolvedValue({ rewardValue: 10, rewardThresholdPoints: 100 } as any);
    vi.mocked(User.findById).mockResolvedValue({ points: 35 } as any);
    vi.mocked(PointsTransaction.find).mockReturnValue({ sort: () => ({ limit: async () => [] }) } as any);
  });

  it.each([0, 1, 4])("reports %i unconsumed rewards independently of the points remainder", async count => {
    const userId = new Types.ObjectId();
    vi.mocked(RewardToken.countDocuments).mockResolvedValue(count);
    const summary = await getPointsSummary(userId, "branch");
    expect(RewardToken.countDocuments).toHaveBeenCalledWith({ user: userId, consumed: false });
    expect(summary).toMatchObject({ points: 35, rewardCount: count, rewardAvailable: count > 0 });
  });
});
