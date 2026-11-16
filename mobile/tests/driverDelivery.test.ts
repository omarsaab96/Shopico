import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ put: vi.fn(), get: vi.fn() }));
vi.mock("../lib/api", () => ({ default: mocks }));
import { reconcileDriverDelivery, startDriverDelivery } from "../lib/driverDelivery";

let sequence = 0;
let orderId: string;
const earlier = "2026-11-16T10:00:00.000Z";
const later = "2026-11-16T10:01:00.000Z";
const newest = "2026-11-16T10:02:00.000Z";
const started = () => ({ _id: orderId, driverId: "driver-a", status: "SHIPPING", driverStartedAt: later, updatedAt: later });
beforeEach(() => { mocks.put.mockReset(); mocks.get.mockReset(); orderId = `order-${++sequence}`; });

describe("confirmed driver starts", () => {
  it("returns the server-saved start rather than inventing one locally", async () => {
    mocks.put.mockResolvedValue({ data: { data: started() } });
    expect((await startDriverDelivery(orderId)).driverStartedAt).toBe(later);
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("reads the order back if the update response is incomplete", async () => {
    mocks.put.mockResolvedValue({ data: { data: { _id: orderId, status: "SHIPPING" } } });
    mocks.get.mockResolvedValue({ data: { data: started() } });
    expect((await startDriverDelivery(orderId)).driverStartedAt).toBe(later);
    expect(mocks.get).toHaveBeenCalledWith(`/orders/${orderId}`);
  });
  it("rejects a successful status-only response when the server has not saved a start", async () => {
    mocks.put.mockResolvedValue({ data: { data: { _id: orderId, status: "SHIPPING" } } });
    mocks.get.mockResolvedValue({ data: { data: { _id: orderId, status: "SHIPPING", driverStartedAt: null } } });
    await expect(startDriverDelivery(orderId)).rejects.toMatchObject({ code: "DELIVERY_START_NOT_CONFIRMED" });
  });
  it("does not navigate for a late start response after a newer completion", async () => {
    reconcileDriverDelivery(started());
    reconcileDriverDelivery({ ...started(), status: "DELIVERED", updatedAt: newest });
    mocks.put.mockResolvedValue({ data: { data: started() } });
    await expect(startDriverDelivery(orderId)).rejects.toMatchObject({ code: "DELIVERY_START_NOT_CONFIRMED" });
  });
  it("preserves backend errors instead of continuing to tracking/navigation", async () => {
    mocks.put.mockRejectedValue({ response: { status: 409 } });
    await expect(startDriverDelivery(orderId)).rejects.toMatchObject({ response: { status: 409 } });
    expect(mocks.get).not.toHaveBeenCalled();
  });
});

describe("late driver order refreshes", () => {
  it("cannot reset a confirmed start in the list or Directions", () => {
    reconcileDriverDelivery(started());
    const old = { ...started(), driverStartedAt: null, updatedAt: earlier };
    expect(reconcileDriverDelivery(old).driverStartedAt).toBe(later);
  });
  it("keeps a confirmed timestamp if a same-version response omits the field", () => {
    reconcileDriverDelivery(started());
    expect(reconcileDriverDelivery({ ...started(), driverStartedAt: undefined }).driverStartedAt).toBe(later);
  });
  it("accepts a newer completion and does not let a late shipping response resurrect it", () => {
    reconcileDriverDelivery(started());
    expect(reconcileDriverDelivery({ ...started(), status: "DELIVERED", updatedAt: newest }).status).toBe("DELIVERED");
    expect(reconcileDriverDelivery(started()).status).toBe("DELIVERED");
  });
  it("accepts an explicit newer reset or reassignment", () => {
    reconcileDriverDelivery(started());
    expect(reconcileDriverDelivery({ ...started(), driverStartedAt: null, updatedAt: newest }).driverStartedAt).toBeNull();
    expect(reconcileDriverDelivery({ ...started(), driverId: "driver-b", driverStartedAt: null }).driverStartedAt).toBeNull();
  });
});
