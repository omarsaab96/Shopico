export const refundMoney = (value: number) => Math.round((value + Number.EPSILON) * 1e8) / 1e8;

type RefundableOrder = {
  status: string; subtotal: number; discount: number; total: number; deliveryFee: number;
  deliveryDiscount?: number;
  items: { quantity: number; price: number; refundedQuantity?: number }[];
};

export function calculateItemRefund(order: RefundableOrder, itemIndex: number, quantity: number) {
  if (!["PENDING", "PROCESSING"].includes(order.status)) throw { status: 400, message: "Items can only be refunded while an order is pending or processing" };
  const item = order.items[itemIndex];
  if (!Number.isInteger(itemIndex) || !item) throw { status: 400, message: "Invalid order item" };
  const refundedQuantity = item.refundedQuantity || 0;
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > item.quantity - refundedQuantity) {
    throw { status: 400, message: "Refund quantity exceeds the remaining item quantity" };
  }
  const gross = refundMoney(item.price * quantity);
  if (gross < 0 || gross > order.subtotal + 1e-7) throw { status: 409, message: "Order totals have changed. Reload the order" };
  const deliveryDiscount = Math.min(order.deliveryFee, Math.max(0, order.deliveryDiscount || 0));
  const discountRate = order.subtotal > 0 ? Math.min(1, Math.max(0, order.discount - deliveryDiscount) / order.subtotal) : 0;
  const subtotal = refundMoney(Math.max(0, order.subtotal - gross));
  const discountReduction = refundMoney(gross * discountRate);
  const discount = refundMoney(Math.max(deliveryDiscount, order.discount - discountReduction));
  const total = refundMoney(Math.max(0, subtotal + order.deliveryFee - discount));
  const amount = refundMoney(order.total - total);
  if (amount < 0 || amount > order.total + 1e-7) throw { status: 409, message: "Order totals are inconsistent. Reload the order" };
  return { amount, subtotal, discount, total, discountReduction, refundedQuantity, gross };
}
