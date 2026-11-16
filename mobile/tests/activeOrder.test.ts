import { describe, expect, it } from "vitest";
import { selectActiveOrder } from "../lib/activeOrder";

const orders = [
  { _id: "delivery", status: "SHIPPING", createdAt: "2026-11-01T12:00:00Z" },
  { _id: "queued", status: "PROCESSING", createdAt: "2026-11-02T12:00:00Z" },
  { _id: "completed", status: "DELIVERED", createdAt: "2026-11-03T12:00:00Z" },
];
describe("active order banners", () => {
  it("shows the customer's newest active order", () => {
    expect(selectActiveOrder(orders, false)?._id).toBe("queued");
  });
  it("shows the driver's shipping order instead of a newer queued assignment", () => {
    expect(selectActiveOrder(orders, true)?._id).toBe("delivery");
  });
  it("hides the driver's banner when no delivery is underway", () => {
    expect(selectActiveOrder(orders.filter(order => order.status !== "SHIPPING"), true)).toBeNull();
  });
  it("excludes completed and cancelled orders for both roles", () => {
    const inactive = [orders[2], { _id: "cancelled", status: "CANCELLED" }, { _id: "hidden", status: "PENDING", cancelledByCustomer: true }];
    expect(selectActiveOrder(inactive, false)).toBeNull();
    expect(selectActiveOrder(inactive, true)).toBeNull();
  });
});
