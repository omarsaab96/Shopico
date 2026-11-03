import { describe, expect, test } from "vitest";
import { assertOrderCanRemainActive, calculateItemRefund } from "../utils/orderRefund";

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
  test("refunding all remaining units also returns delivery charges", () => {
    const order = { ...base(), discount: 20, total: 90 };
    let refunded = 0;
    for (const index of [0, 0, 1]) {
      const next = calculateItemRefund(order, index, 1);
      Object.assign(order, { subtotal: next.subtotal, discount: next.discount, total: next.total });
      order.items[index].refundedQuantity = next.refundedQuantity + 1;
      refunded += next.amount;
    }
    expect(refunded).toBe(90);
    expect(order.total).toBe(0);
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
  test("the final item cancels the order and waives the delivery fee", () => {
    expect(calculateItemRefund({ ...base(), subtotal: 1430, deliveryFee: 460, total: 1890, items: [{ quantity: 1, price: 1430 }] }, 0, 1)).toMatchObject({ amount: 1890, total: 0, subtotal: 0, deliveryFee: 0, discount: 0, cancelOrder: true });
  });
  test("a free item with remaining units still keeps the order active", () => {
    expect(calculateItemRefund({ ...base(), items: [...base().items, { quantity: 1, price: 0 }] }, 0, 2).cancelOrder).toBe(false);
  });
  test("orders whose items are fully refunded cannot be reopened", () => {
    const order = { items: [{ quantity: 1, price: 25, refundedQuantity: 1 }] };
    expect(() => assertOrderCanRemainActive(order, "PROCESSING")).toThrow();
    expect(() => assertOrderCanRemainActive(order, "CANCELLED")).not.toThrow();
  });
});
