import { beforeEach, expect, test, vi } from "vitest";
import { Order } from "../models/Order";
import { User } from "../models/User";
import { assignDriverToOrder, updateOrderDetails, updateOrderStatus } from "../services/orderService";
vi.mock("../models/Order", () => ({ Order: { findOne: vi.fn(), exists: vi.fn() } }));
vi.mock("../models/User", () => ({ User: { findOne: vi.fn(), findByIdAndUpdate: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());
const operations = [
  () => assignDriverToOrder("order", "new-driver", "branch"),
  () => updateOrderDetails("order", { driverId: "new-driver" }, "branch"),
  () => updateOrderDetails("order", { driverId: null }, "branch"),
  () => updateOrderStatus("order", "DELIVERED", undefined, "branch", "new-driver"),
  () => updateOrderStatus("order", "PROCESSING", undefined, "branch", "new-driver"),
];
for (const status of ["DELIVERED", "PROCESSING"] as const) {
  test.each(operations.map((operation, index) => ({ operation, index })))(`blocks driver changes through route $index after delivery (current status ${status})`, async ({ operation }) => {
    const save = vi.fn();
    vi.mocked(Order.findOne).mockResolvedValue({ status, driverId: "original-driver", statusHistory: [{ status: "DELIVERED" }], save, $locals: {} } as never);
    await expect(operation()).rejects.toMatchObject({ status: 400, message: "The driver cannot be changed after an order has been delivered" });
    expect(save).not.toHaveBeenCalled();
    expect(User.findOne).not.toHaveBeenCalled();
  });
}
test("a currently delivered order is locked even without status history", async () => {
  vi.mocked(Order.findOne).mockResolvedValue({ status: "DELIVERED", driverId: "original-driver" } as never);
  await expect(assignDriverToOrder("order", "new-driver", "branch")).rejects.toMatchObject({ status: 400 });
});

test.each(["PENDING", "PROCESSING", "SHIPPING"])("still allows assigning drivers before delivery (%s)", async status => {
  const order = { status, driverId: "old-driver", statusHistory: [], save: vi.fn(), $locals: {} };
  vi.mocked(Order.findOne).mockResolvedValue(order as never);
  vi.mocked(User.findOne).mockResolvedValue({ _id: "new-driver" } as never);
  await assignDriverToOrder("order", "new-driver", "branch");
  expect(order.driverId).toBe("new-driver");
  expect(order.save).toHaveBeenCalledOnce();
});
test("accepts an unchanged driver on a delivered order", async () => {
  const order = { status: "DELIVERED", driverId: "original-driver", save: vi.fn(), $locals: {} };
  vi.mocked(Order.findOne).mockResolvedValue(order as never);
  vi.mocked(User.findOne).mockResolvedValue({ _id: "original-driver" } as never);
  await expect(assignDriverToOrder("order", "original-driver", "branch")).resolves.toBe(order);
});
