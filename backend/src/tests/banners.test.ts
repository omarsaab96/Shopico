import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Request, Response } from "express";
import { Banner } from "../models/Banner";
import { listActiveBanners, updateBanner, deleteBanner } from "../controllers/bannerController";
import { bannerSchema } from "../validators/bannerValidators";

vi.mock("../models/Banner", () => ({ Banner: { find: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn(), findOneAndDelete: vi.fn() } }));
vi.mock("../utils/branch", () => ({ getDefaultBranchId: vi.fn() }));
const response = () => {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  return res;
};
beforeEach(() => vi.clearAllMocks());

describe("home banners", () => {
  test("requires an image and rejects unsafe links", () => {
    expect(bannerSchema.safeParse({ title: "Sale" }).success).toBe(false);
    const image = { url: "https://example.com/banner.jpg", fileId: "image-id" };
    expect(bannerSchema.safeParse({ image, link: "https://example.com/sale" }).success).toBe(true);
    expect(bannerSchema.safeParse({ image, link: "javascript:alert(1)" }).success).toBe(false);
  });

  test("mobile feed only selects enabled, scheduled banners in the current branch", async () => {
    const sort = vi.fn().mockResolvedValue([]);
    vi.mocked(Banner.find).mockReturnValue({ sort } as never);
    const res = response();
    const next = vi.fn();
    await listActiveBanners({ branchId: "branch-a" } as unknown as Request, res as unknown as Response, next);
    expect(next).not.toHaveBeenCalled();
    expect(Banner.find).toHaveBeenCalledWith({ branchId: "branch-a", isEnabled: true, startsAt: { $lte: expect.any(Date) }, endsAt: { $gte: expect.any(Date) } });
  });

  test("partial edits cannot move the end date before the existing start", async () => {
    vi.mocked(Banner.findOne).mockResolvedValue({ startsAt: new Date("2026-11-10"), endsAt: new Date("2026-11-20") } as never);
    const res = response();
    await updateBanner({ branchId: "branch-a", params: { id: "banner-id" }, body: { endsAt: "2026-11-01" } } as unknown as Request, res as unknown as Response, vi.fn());
    expect(Banner.findOne).toHaveBeenCalledWith({ _id: "banner-id", branchId: "branch-a" });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(Banner.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("deletion is restricted to the selected branch", async () => {
    vi.mocked(Banner.findOneAndDelete).mockResolvedValue(null);
    const res = response();
    await deleteBanner({ branchId: "branch-a", params: { id: "other-branch-banner" } } as unknown as Request, res as unknown as Response, vi.fn());
    expect(Banner.findOneAndDelete).toHaveBeenCalledWith({ _id: "other-branch-banner", branchId: "branch-a" });
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
