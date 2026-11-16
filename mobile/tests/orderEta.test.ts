import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestOrderEta } from "../lib/orderEta";
import type { OrderPreview } from "../lib/orderPreview";

const fetchMock = vi.fn();
const order: OrderPreview = { _id: "order", status: "SHIPPING", lat: 33.5, lng: 36.3, driverLocation: { lat: 33.51, lng: 36.32 } };
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());
const respond = (payload: unknown, ok = true) => fetchMock.mockResolvedValue({ ok, json: async () => payload });

describe("last-order ETA", () => {
  it("uses the driver's route and converts duration seconds into minutes", async () => {
    respond({ status: "OK", routes: [{ legs: [{ duration: { value: 120 } }, { duration: { value: 180 } }] }] });
    expect(await requestOrderEta(order, "test-key")).toBe(5);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get("origin")).toBe("33.51,36.32");
    expect(url.searchParams.get("destination")).toBe("33.5,36.3");
  });
  it.each(["PENDING", "PROCESSING", "DELIVERED", "CANCELLED"])("does not request an ETA for %s", async status => {
    expect(await requestOrderEta({ ...order, status }, "test-key")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not fabricate an ETA when GPS, destination, or the API key is missing", async () => {
    expect(await requestOrderEta({ ...order, driverLocation: null }, "test-key")).toBeNull();
    expect(await requestOrderEta({ ...order, lat: undefined }, "test-key")).toBeNull();
    expect(await requestOrderEta(order, "")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([
    { status: "ZERO_RESULTS", routes: [] },
    { status: "REQUEST_DENIED" },
    { status: "OK", routes: [{ legs: [{}] }] },
    { status: "OK", routes: [{ legs: [{ duration: { value: -1 } }] }] },
  ])("omits unavailable or invalid route estimates", async payload => {
    respond(payload);
    expect(await requestOrderEta(order, "test-key")).toBeNull();
  });
  it("handles HTTP and connectivity failures without breaking the card", async () => {
    respond({}, false);
    expect(await requestOrderEta(order, "test-key")).toBeNull();
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await requestOrderEta(order, "test-key")).toBeNull();
  });
  it("accepts a valid zero-minute arrival", async () => {
    respond({ status: "OK", routes: [{ legs: [{ duration: { value: 0 } }] }] });
    expect(await requestOrderEta(order, "test-key")).toBe(0);
  });
});
