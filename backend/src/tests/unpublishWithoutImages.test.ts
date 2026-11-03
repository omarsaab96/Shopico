import { beforeEach, expect, test, vi } from "vitest";
import type { Request, Response } from "express";
import { Product } from "../models/Product";
import { unpublishProductsWithoutImages } from "../controllers/productController";
vi.mock("../models/Product", () => ({ Product: { updateMany: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });
test("unpublishes only currently public products without images in the selected branch", async () => {
  vi.mocked(Product.updateMany).mockResolvedValue({ modifiedCount: 7 } as never);
  const res = response();
  const next = vi.fn();
  await unpublishProductsWithoutImages({ branchId: "branch-a" } as unknown as Request, res as unknown as Response, next);
  expect(next).not.toHaveBeenCalled();
  expect(Product.updateMany).toHaveBeenCalledWith(
    { branchId: "branch-a", isPublic: { $ne: false }, "images.0": { $exists: false } },
    { $set: { isPublic: false } }
  );
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { modifiedCount: 7 } }));
});
test("refuses to update products without a branch", async () => {
  const res = response();
  await unpublishProductsWithoutImages({} as Request, res as unknown as Response, vi.fn());
  expect(res.status).toHaveBeenCalledWith(400);
  expect(Product.updateMany).not.toHaveBeenCalled();
});
test("reports zero when there are no matching published products", async () => {
  vi.mocked(Product.updateMany).mockResolvedValue({ modifiedCount: 0 } as never);
  const res = response();
  await unpublishProductsWithoutImages({ branchId: "branch-a" } as unknown as Request, res as unknown as Response, vi.fn());
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { modifiedCount: 0 } }));
});
