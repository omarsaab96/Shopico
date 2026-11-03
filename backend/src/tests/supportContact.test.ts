import { beforeEach, expect, test, vi } from "vitest";
import type { Request, Response } from "express";
import { getSupportContactHandler } from "../controllers/settingsController";
import { getSettings } from "../services/settingsService";
import { Branch } from "../models/Branch";
vi.mock("../services/settingsService", () => ({ getSettings: vi.fn(), updateSettings: vi.fn() }));
vi.mock("../models/Branch", () => ({ Branch: { findById: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());
const lookup = async () => {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  await getSupportContactHandler({ branchId: "selected-branch" } as unknown as Request, res as unknown as Response, next);
  expect(next).not.toHaveBeenCalled();
  return res;
};
test("uses the settings support number first", async () => {
  vi.mocked(getSettings).mockResolvedValue({ supportPhone: " +963944111111 " } as never);
  const res = await lookup();
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { supportPhone: "+963944111111" } }));
  expect(Branch.findById).not.toHaveBeenCalled();
});
test("falls back to the selected branch phone when settings is empty", async () => {
  vi.mocked(getSettings).mockResolvedValue({ supportPhone: "" } as never);
  vi.mocked(Branch.findById).mockReturnValue({ select: vi.fn().mockResolvedValue({ phone: "+963944222222" }) } as never);
  const res = await lookup();
  expect(Branch.findById).toHaveBeenCalledWith("selected-branch");
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { supportPhone: "+963944222222" } }));
});
