export type UserRole = "customer" | "admin" | "manager" | "staff" | "driver";

export type PaymentMethod =
  | "CASH_ON_DELIVERY"
  | "SHAM_CASH"
  | "BANK_TRANSFER"
  | "WALLET";

export type OrderStatus = "PENDING" | "PROCESSING" | "SHIPPING" | "DELIVERED" | "CANCELLED";

export type TopUpMethod = "CASH_STORE" | "SHAM_CASH" | "BANK_TRANSFER";

export type TopUpStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: unknown;
}
