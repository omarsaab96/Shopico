import { beforeEach, describe, expect, test, vi } from "vitest";
import { Currency } from "../models/Currency";
import { Settings } from "../models/Settings";
import { refreshMembershipFromWallet } from "../utils/membership";
import type { IUser } from "../models/User";

vi.mock("../models/Currency", () => ({ Currency: { findOne: vi.fn() } }));
vi.mock("../models/Settings", () => ({ Settings: { findOne: vi.fn() } }));
vi.mock("../models/User", () => ({ User: {} }));
vi.mock("../models/Wallet", () => ({ Wallet: {} }));
const thresholds = { silver: 100, gold: 200, platinum: 1000000000, diamond: 2000000000 };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(Currency.findOne).mockResolvedValue({ _id: "syp" } as never);
  vi.mocked(Settings.findOne).mockResolvedValue({
    membershipGraceDays: 14,
    membershipThresholds: { silver: 1e10, gold: 2e10, platinum: 3e10, diamond: 4e10 },
    membershipThresholdsByCurrency: [{ currency: "syp", thresholds }],
  } as never);
});
const makeUser = (level = "None", grace: Date | null = null) => ({ membershipLevel: level, membershipGraceUntil: grace, save: vi.fn() }) as unknown as IUser;
describe("membership refresh from wallet", () => {
  test("repairs a stale None level using the matching currency thresholds", async () => {
    const user = makeUser();
    await refreshMembershipFromWallet(user, { balance: 0, balances: [{ currency: { _id: "syp" }, amount: 999999999 }] }, "branch");
    expect(user.membershipLevel).toBe("Gold");
    expect(user.save).toHaveBeenCalled();
    expect(Settings.findOne).toHaveBeenCalledWith({ branchId: "branch" });
  });
  test("supports legacy wallets with only a balance", async () => {
    const user = makeUser();
    await refreshMembershipFromWallet(user, { balance: 999999999, balances: [] }, "branch");
    expect(user.membershipLevel).toBe("Gold");
  });
  test("does not treat a different currency balance as primary", async () => {
    const user = makeUser();
    await refreshMembershipFromWallet(user, { balance: 999999999, balances: [{ currency: "usd", amount: 999999999 }] }, "branch");
    expect(user.membershipLevel).toBe("None");
  });
  test("preserves active downgrade grace", async () => {
    const grace = new Date(Date.now() + 86400000);
    const user = makeUser("Gold", grace);
    await refreshMembershipFromWallet(user, { balance: 0 }, "branch");
    expect(user.membershipLevel).toBe("Gold");
    expect(user.membershipGraceUntil).toBe(grace);
  });
  test("applies a downgrade when grace expires", async () => {
    const user = makeUser("Gold", new Date(Date.now() - 1000));
    await refreshMembershipFromWallet(user, null, "branch");
    expect(user.membershipLevel).toBe("None");
    expect(user.membershipGraceUntil).toBeNull();
  });
});
