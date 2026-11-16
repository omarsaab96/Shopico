import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { listAvailableCoupons } from "../controllers/couponController";
import { Coupon } from "../models/Coupon";
import { CouponRedemption } from "../models/CouponRedemption";
import { Currency } from "../models/Currency";

vi.mock("../models/Coupon", () => ({ Coupon: { find: vi.fn() } }));
vi.mock("../models/CouponRedemption", () => ({ CouponRedemption: { countDocuments: vi.fn() } }));
vi.mock("../models/Currency", () => ({ Currency: { findOne: vi.fn() } }));

const userId = new Types.ObjectId();
const currencyId = new Types.ObjectId();
const coupon = (personal = true) => ({
  _id: new Types.ObjectId(), code: "MY800", assignedUsers: personal ? [userId] : [], assignedProducts: [],
  assignedMembershipLevels: [], currency: currencyId, discountType: "FIXED", discountValue: 800,
  usageType: "SINGLE", usedCount: 0, freeDelivery: false,
});

async function available(subtotal: number) {
  const json = vi.fn();
  const res = { status: vi.fn().mockReturnThis(), json };
  const next = vi.fn();
  await listAvailableCoupons({ branchId: new Types.ObjectId().toString(), user: { _id: userId },
    body: { subtotal, items: [], currencyId: currencyId.toString() } } as any, res as any, next);
  expect(next).not.toHaveBeenCalled();
  return json.mock.calls[0][0].data;
}

describe("cart coupon unlock amounts", () => {
  beforeEach(() => {
    vi.mocked(Coupon.find).mockResolvedValue([coupon()] as any);
    vi.mocked(CouponRedemption.countDocuments).mockResolvedValue(0);
    vi.mocked(Currency.findOne).mockResolvedValue({ _id: currencyId, isPrimary: true, exchangeRate: 1 } as any);
  });
  it("returns a 20 shortfall for an 800 discount on a 780 cart", async () => {
    expect((await available(780))[0]).toMatchObject({ isPersonal: true, amountToUnlock: 20, discount: 800, disabled: true });
  });
  it("clears the shortfall when the subtotal reaches the discount", async () => {
    expect((await available(800))[0]).toMatchObject({ amountToUnlock: 0, disabled: false });
  });
  it("returns primary amounts for a non-primary coupon so the app converts once", async () => {
    vi.mocked(Currency.findOne).mockResolvedValue({ _id: currencyId, isPrimary: false, exchangeRate: 2 } as any);
    expect((await available(1560))[0]).toMatchObject({ amountToUnlock: 40, discount: 1600 });
  });
  it("distinguishes public offers from the user's coupons", async () => {
    vi.mocked(Coupon.find).mockResolvedValue([coupon(false)] as any);
    expect((await available(780))[0].isPersonal).toBe(false);
  });
});
