import { describe, expect, test } from "vitest";
import { calculateItemRefund } from "../utils/orderRefund";

const base = () => ({ status: "PENDING", subtotal: 100, deliveryFee: 10, discount: 0, total: 110, items: [{ quantity: 2, price: 25, refundedQuantity: 0 }, { quantity: 1, price: 50 }] });

describe("unavailable order item refunds", () => {
  test("supports partial quantities and preserves delivery", () => {
    expect(calculateItemRefund(base(), 0, 1)).toMatchObject({ amount: 25, subtotal: 75, discount: 0, total: 85 });
  });
  test("prorates discounts instead of refunding the undiscounted item price", () => {
    expect(calculateItemRefund({ ...base(), discount: 20, total: 90 }, 0, 1)).toMatchObject({ amount: 20, subtotal: 75, discount: 15, total: 70 });
  });
  test("keeps free-delivery discounts separate from merchandise discounts", () => {
    expect(calculateItemRefund({ ...base(), discount: 10, deliveryDiscount: 10, total: 100 }, 0, 1)).toMatchObject({ amount: 25, discount: 10, total: 75 });
  });
  test("repeated partial refunds never exceed the paid merchandise amount", () => {
    const order = { ...base(), discount: 20, total: 90 };
    let refunded = 0;
    for (const index of [0, 0, 1]) {
      const next = calculateItemRefund(order, index, 1);
      Object.assign(order, { subtotal: next.subtotal, discount: next.discount, total: next.total });
      order.items[index].refundedQuantity = next.refundedQuantity + 1;
      refunded += next.amount;
    }
    expect(refunded).toBe(80);
    expect(order.total).toBe(10);
  });
  test("fully discounted items produce no wallet credit", () => {
    expect(calculateItemRefund({ ...base(), discount: 120, total: 0 }, 0, 1).amount).toBe(0);
  });
  test("rejects duplicate quantities, invalid item indexes and invalid quantities", () => {
    const order = base();
    order.items[0].refundedQuantity = 1;
    for (const quantity of [0, -1, 0.5, 2]) expect(() => calculateItemRefund(order, 0, quantity)).toThrow();
    expect(() => calculateItemRefund(order, 99, 1)).toThrow();
  });
  test.each(["SHIPPING", "DELIVERED", "CANCELLED"])("rejects refunds after %s", status => {
    expect(() => calculateItemRefund({ ...base(), status }, 0, 1)).toThrow();
  });
});
