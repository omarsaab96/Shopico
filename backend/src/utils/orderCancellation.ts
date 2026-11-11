export const CANCELLATION_WINDOW_MS = 2 * 60 * 1000;

// Orders created before this feature have no deadline and remain visible.
export const staffOrderFilter = (now = new Date()) => ({
  cancelledByCustomer: { $ne: true },
  $or: [{ cancellationUntil: { $exists: false } }, { cancellationUntil: null }, { cancellationUntil: { $lte: now } }],
});

export function assertStaffOrderAvailable(order: { cancellationUntil?: Date; cancelledByCustomer?: boolean }) {
  if (order.cancelledByCustomer || (order.cancellationUntil && order.cancellationUntil.getTime() > Date.now())) {
    throw { status: 404, message: "Order not found" };
  }
}
