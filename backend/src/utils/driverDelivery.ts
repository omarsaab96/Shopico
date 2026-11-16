export const SINGLE_DRIVER_DELIVERY_INDEX = "one_shipping_order_per_driver";
export const DRIVER_DELIVERY_CONFLICT = "Finish the current delivery before starting another order";

export class DriverDeliveryConflictError extends Error {
  readonly status = 409;
  readonly code = "DRIVER_ALREADY_DELIVERING";
  constructor() { super(DRIVER_DELIVERY_CONFLICT); }
}
