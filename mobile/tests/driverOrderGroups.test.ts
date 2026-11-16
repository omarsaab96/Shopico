import { describe, expect, it } from "vitest";
import { groupDriverOrders, driverDeliveryAction } from "../lib/driverOrderGroups";

describe("driver order filters", () => {
  it("groups pending/processing, shipping, and delivered orders as requested", () => {
    const pending = { _id: "pending", status: "PENDING" };
    const processing = { _id: "processing", status: "PROCESSING" };
    const shipping = { _id: "shipping", status: "SHIPPING" };
    const delivered = { _id: "delivered", status: "DELIVERED" };
    expect(groupDriverOrders([pending, shipping, processing, delivered, { _id: "cancelled", status: "CANCELLED" }]))
      .toEqual({ upcoming: [pending, processing], ready: [shipping], previous: [delivered] });
  });
  it("moves a delivery between groups as its status changes", () => {
    const order = { _id: "order", status: "PROCESSING" };
    expect(groupDriverOrders([order]).upcoming).toHaveLength(1);
    order.status = "SHIPPING";
    expect(groupDriverOrders([order])).toEqual({ upcoming: [], ready: [order], previous: [] });
    order.status = "DELIVERED";
    expect(groupDriverOrders([order])).toEqual({ upcoming: [], ready: [], previous: [order] });
  });
  it("keeps the current delivery out of the tabs while retaining unstarted shipping orders", () => {
    const current = { _id: "current", status: "SHIPPING", driverStartedAt: "2026-11-16T14:00:00Z" };
    const ready = { _id: "ready", status: "SHIPPING", driverStartedAt: null };
    expect(groupDriverOrders([current, ready])).toEqual({ upcoming: [], ready: [ready], previous: [] });
    expect(groupDriverOrders([{ ...current, status: "DELIVERED" }]).previous).toHaveLength(1);
  });
  it("handles empty lists and excludes unknown statuses", () => {
    expect(groupDriverOrders([])).toEqual({ upcoming: [], ready: [], previous: [] });
    expect(groupDriverOrders([{ status: "UNKNOWN" }])).toEqual({ upcoming: [], ready: [], previous: [] });
  });
});

describe("driver delivery button lifecycle", () => {
  it("shows Start delivery for a ready order until the driver starts it", () => {
    expect(driverDeliveryAction({ status: "SHIPPING", driverStartedAt: null })).toBe("start");
  });
  it("switches to Mark as delivered using the saved start timestamp, including after reload", () => {
    const order = { status: "SHIPPING", driverStartedAt: "2026-11-16T14:00:00Z" };
    expect(driverDeliveryAction(order)).toBe("deliver");
    expect(driverDeliveryAction(JSON.parse(JSON.stringify(order)))).toBe("deliver");
  });
  it.each(["PENDING", "PROCESSING", "DELIVERED", "CANCELLED"])("does not offer a delivery action for %s", status => {
    expect(driverDeliveryAction({ status, driverStartedAt: "2026-11-16T14:00:00Z" })).toBeNull();
  });
});

it("keeps released processing orders ready until the driver starts", () => {
  const ready = { status: "PROCESSING", driverReadyAt: "2026-11-16T14:00:00Z" };
  expect(groupDriverOrders([ready])).toEqual({ upcoming: [], ready: [ready], previous: [] });
  expect(driverDeliveryAction(ready)).toBe("start");
});
