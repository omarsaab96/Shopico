import { describe, expect, test } from "vitest";
import { getOpeningStatus } from "../utils/openingHours";
import { branchSchema } from "../validators/branchValidators";
import { Branch } from "../models/Branch";
import { Order } from "../models/Order";

const schedule = { timeZone: "Asia/Damascus", openingHours: [
  { day: 2, start: "09:00", end: "12:00" }, { day: 2, start: "16:00", end: "20:00" },
] };
const at = (iso: string) => getOpeningStatus(schedule, new Date(iso));
describe("branch availability", () => {
  test("legacy branches stay available; empty schedule is closed", () => {
    expect(getOpeningStatus({}).isOpen).toBe(true);
    expect(getOpeningStatus({ openingHours: [] })).toMatchObject({ isOpen: false, nextOpeningAt: null });
    expect(new Branch({}).openingHours).toBeUndefined();
  });
  test("opens inclusively and closes exclusively in branch timezone", () => {
    expect(at("2026-11-17T05:59:59Z")).toMatchObject({ isOpen: false, nextOpeningAt: "2026-11-17T06:00:00.000Z" });
    expect(at("2026-11-17T06:00:00Z").isOpen).toBe(true);
    expect(at("2026-11-17T09:00:00Z")).toMatchObject({ isOpen: false, nextOpeningAt: "2026-11-17T13:00:00.000Z" });
    expect(at("2026-11-17T13:00:00Z").isOpen).toBe(true);
  });
  test("wraps to next week after the last slot", () => {
    expect(at("2026-11-17T17:00:00Z").nextOpeningAt).toBe("2026-11-24T06:00:00.000Z");
  });
  test("overnight slots continue into next day and cross week boundary", () => {
    const branch = { timeZone: "UTC", openingHours: [{ day: 6, start: "22:00", end: "02:00" }] };
    expect(getOpeningStatus(branch, new Date("2026-11-15T01:59:59Z")).isOpen).toBe(true);
    expect(getOpeningStatus(branch, new Date("2026-11-15T02:00:00Z"))).toMatchObject({ isOpen: false, nextOpeningAt: "2026-11-21T22:00:00.000Z" });
  });
  test("uses timezone offsets on the opening date across daylight savings", () => {
    const branch = { timeZone: "America/New_York", openingHours: [{ day: 1, start: "09:00", end: "17:00" }] };
    expect(getOpeningStatus(branch, new Date("2026-10-31T12:00:00Z")).nextOpeningAt).toBe("2026-11-02T14:00:00.000Z");
  });
  test("persists the availability snapshot on an order", () => {
    const status = at("2026-11-17T10:00:00Z");
    expect(new Order({ openingStatus: status }).toObject().openingStatus).toMatchObject(status);
  });
});
const valid = { name: "Branch", address: "Address", lat: 0, lng: 0 };
test.each([
  [{ day: 7, start: "09:00", end: "12:00" }],
  [{ day: 1, start: "25:00", end: "12:00" }],
  [{ day: 1, start: "09:00", end: "09:00" }],
  [{ day: 1, start: "09:00", end: "12:00" }, { day: 1, start: "11:00", end: "14:00" }],
  [{ day: 6, start: "22:00", end: "02:00" }, { day: 0, start: "01:00", end: "03:00" }],
])("rejects invalid or overlapping slots: %j", (...openingHours) => {
  expect(branchSchema.safeParse({ ...valid, openingHours }).success).toBe(false);
});
test("accepts adjacent slots, unsorted slots and clearing a schedule", () => {
  expect(branchSchema.safeParse({ ...valid, openingHours: [{ day: 1, start: "12:00", end: "18:00" }, { day: 1, start: "09:00", end: "12:00" }] }).success).toBe(true);
  expect(branchSchema.partial().safeParse({ openingHours: null }).success).toBe(true);
  expect(branchSchema.partial().safeParse({ timeZone: "Invalid/Zone" }).success).toBe(false);
});
