import { describe, expect, test } from "vitest";
import { calculateDeliveryFee, calculatePointsEarned, haversineDistanceKm } from "../utils/pricing";

describe("delivery fee calculation", () => {
  test("free delivery within 1km", () => {
    expect(calculateDeliveryFee(0.8)).toBe(0);
    expect(calculateDeliveryFee(1)).toBe(0);
  });

  test("charges per additional km rounded up", () => {
    expect(calculateDeliveryFee(1.1)).toBe(5000);
    expect(calculateDeliveryFee(1.9)).toBe(5000);
    expect(calculateDeliveryFee(2.2)).toBe(10000);
  });
});

describe("points calculation", () => {
  test("earn 1 point per 10,000 SYP on subtotal", () => {
    expect(calculatePointsEarned(9000, 10000)).toBe(0);
    expect(calculatePointsEarned(10000, 10000)).toBe(1);
    expect(calculatePointsEarned(25500, 10000)).toBe(2);
  });
});

describe("haversine distance", () => {
  test("distance is zero at same point", () => {
    expect(haversineDistanceKm(0, 0, 0, 0)).toBe(0);
  });
});
