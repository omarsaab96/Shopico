import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import type { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { Product } from "../models/Product";
import { listProducts } from "../controllers/productController";

let mongo: MongoMemoryServer;
const branchId = new Types.ObjectId();
beforeAll(async () => {
  mongo = await MongoMemoryServer.create({ binary: { version: "8.0.17" } });
  await mongoose.connect(mongo.getUri());
}, 120000);
afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });
beforeEach(async () => {
  await Product.deleteMany({});
  const rows = [
    { name: "Cheap", price: 49 },
    { name: "Boundary 50", price: 50 },
    { name: "Boundary 1000", price: 1000 },
    { name: "Expensive", price: 1001 },
    { name: "Promotion", price: 2000, promoPrice: 20, isPromoted: true },
    { name: "Grams", price: 0.6, unit: "g" },
    { name: "Liquid", price: 0.08, unit: "ml" },
    { name: "Free promotion", price: 100, promoPrice: 0, isPromoted: true },
    { name: "Hidden", price: 1, isPublic: false },
    { name: "Unavailable", price: 1, isAvailable: false },
    { name: "Other branch", price: 1, branchId: new Types.ObjectId() },
  ];
  await Product.insertMany(rows.map((row, index) => ({ branchId, barcode: `filter-${index}`, ...row })));
});
const list = async (query: Record<string, string>) => {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  await listProducts({ branchId: String(branchId), query } as unknown as Request, res as unknown as Response, next);
  expect(next).not.toHaveBeenCalled();
  return res.json.mock.calls[0][0].data;
};
const names = (items: any[]) => items.map(item => item.name);

test("price sorting runs before pagination using promotions and displayed unit quantities", async () => {
  const first = await list({ sort: "priceAsc", page: "1", limit: "3" });
  const second = await list({ sort: "priceAsc", page: "2", limit: "3" });
  expect(names(first.items)).toEqual(["Free promotion", "Liquid", "Promotion"]);
  expect(names(second.items)).toEqual(["Cheap", "Boundary 50", "Grams"]);
  expect(first).toMatchObject({ total: 8, hasMore: true });
  expect(first.items[0]).not.toHaveProperty("_displayPrice");
  const descending = await list({ sort: "priceDesc", page: "1", limit: "2" });
  expect(names(descending.items)).toEqual(["Expensive", "Boundary 1000"]);
});

test("strict price ranges exclude boundary values and count only matching visible products", async () => {
  const cheap = await list({ priceBelow: "50", sort: "priceAsc", page: "1" });
  expect(names(cheap.items)).toEqual(["Free promotion", "Liquid", "Promotion", "Cheap"]);
  expect(cheap.total).toBe(4);
  const below1000 = await list({ priceBelow: "1000", page: "1" });
  expect(below1000.total).toBe(6);
  const above1000 = await list({ priceAbove: "1000", page: "1" });
  expect(names(above1000.items)).toEqual(["Expensive"]);
});

test("search and category filters combine with price filters; empty results retain pagination metadata", async () => {
  const category = new Types.ObjectId();
  await Product.updateOne({ name: "Promotion" }, { categories: [category] });
  const matching = await list({ q: "promo", category: String(category), priceBelow: "50", page: "1" });
  expect(names(matching.items)).toEqual(["Promotion"]);
  expect(matching.items[0].categories).toBeInstanceOf(Array);
  const empty = await list({ q: "missing", priceAbove: "1000", page: "1" });
  expect(empty).toMatchObject({ items: [], total: 0, hasMore: false });
});

test("relevance preserves the existing newest-first ordering", async () => {
  await Product.collection.updateOne({ name: "Cheap" }, { $set: { createdAt: new Date("2030-01-01") } });
  const result = await list({ sort: "relevance", priceBelow: "50", page: "1" });
  expect(result.items[0].name).toBe("Cheap");
});
