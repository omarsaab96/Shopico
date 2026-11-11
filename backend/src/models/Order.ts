import { ProductUnit } from "../utils/productUnits";
import { notificationOutbox } from "../notifications/outbox";
import mongoose, { Document, Schema, Types } from "mongoose";
import { OrderStatus, PaymentMethod } from "../types";

export interface IOrderItem {
  product: Types.ObjectId | string;
  variantId?: Types.ObjectId | string;
  variantAttributes?: Record<string, string>;
  unit?: ProductUnit;
  unitLabel?: string;
  quantity: number;
  price: number;
  refundedQuantity?: number;
}

export interface IOrderRefund {
  kind?: "CUSTOMER_CANCELLATION";
  requestId: string;
  itemIndex: number;
  quantity: number;
  amount: number;
  walletAmount: number;
  currency?: Types.ObjectId | string;
  disposition: "WALLET" | "TOTAL_REDUCTION";
  primaryCurrency?: Types.ObjectId | string;
  settlementStatus: "PENDING" | "COMPLETED";
  cancelledOrder?: boolean;
  notificationSent?: boolean;
  actor: Types.ObjectId | string;
  at: Date;
}

export interface IOrderStatusEntry {
  status: OrderStatus;
  at: Date;
}

export interface IOrderDriverLocation {
  lat?: number;
  lng?: number;
  updatedAt: Date;
}

export interface ICashSettlement {
  requestId: string;
  driver: Types.ObjectId | string;
  actor: Types.ObjectId | string;
  amount: number;
  currency: Types.ObjectId | string;
  at: Date;
  note?: string;
}

export interface IOrder extends Document {
  user: Types.ObjectId | string;
  items: IOrderItem[];
  branchId: Types.ObjectId | string;
  currency?: Types.ObjectId | string;
  currencyExchangeRate?: number;
  deliveryDiscount?: number;
  refundTotal: number;
  refunds: IOrderRefund[];
  addressRef?: Types.ObjectId | string | null;
  driverId?: Types.ObjectId | string;
  driverLocation?: IOrderDriverLocation | null;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: "PENDING" | "CONFIRMED";
  cashSettlement?: ICashSettlement | null;
  address: string;
  driverRating?: number | null;
  driverRatedAt?: Date | null;
  lat?: number;
  lng?: number;
  notes?: string;
  subtotal: number;
  deliveryFee: number;
  deliveryDistanceKm: number;
  discount: number;
  couponCode?: string;
  couponCodes?: string[];
  couponDiscount?: number;
  total: number;
  rewardApplied: boolean;
  statusHistory: IOrderStatusEntry[];
  cancellationUntil?: Date;
  cancelledByCustomer?: boolean;
  walletDebitAmount?: number;
  walletDebitCurrency?: Types.ObjectId;
  walletPrimaryCurrency?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: Schema.Types.ObjectId },
    variantAttributes: { type: Schema.Types.Mixed },
    unit: { type: String, enum: ["piece", "g", "ml"], default: "piece" },
    unitLabel: { type: String },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    refundedQuantity: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const StatusEntrySchema = new Schema<IOrderStatusEntry>(
  {
    status: { type: String, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const DriverLocationSchema = new Schema<IOrderDriverLocation>(
  {
    lat: { type: Number },
    lng: { type: Number },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: { type: [OrderItemSchema], required: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    currency: { type: Schema.Types.ObjectId, ref: "Currency" },
    currencyExchangeRate: { type: Number },
    deliveryDiscount: { type: Number },
    cancellationUntil: { type: Date },
    cancelledByCustomer: { type: Boolean, default: false },
    walletDebitAmount: { type: Number },
    walletDebitCurrency: { type: Schema.Types.ObjectId, ref: "Currency" },
    walletPrimaryCurrency: { type: Schema.Types.ObjectId, ref: "Currency" },
    refundTotal: { type: Number, default: 0 },
    refunds: { type: [new Schema<IOrderRefund>({
      kind: { type: String, enum: ["CUSTOMER_CANCELLATION"] },
      requestId: { type: String, required: true },
      itemIndex: { type: Number, required: true },
      quantity: { type: Number, required: true },
      amount: { type: Number, required: true },
      walletAmount: { type: Number, required: true },
      currency: { type: Schema.Types.ObjectId, ref: "Currency" },
      disposition: { type: String, enum: ["WALLET", "TOTAL_REDUCTION"], required: true },
      primaryCurrency: { type: Schema.Types.ObjectId, ref: "Currency" },
      settlementStatus: { type: String, enum: ["PENDING", "COMPLETED"], default: "COMPLETED" },
      cancelledOrder: { type: Boolean, default: false },
      notificationSent: { type: Boolean, default: false },
      actor: { type: Schema.Types.ObjectId, ref: "User", required: true },
      at: { type: Date, default: Date.now },
    }, { _id: false })], default: [] },
    addressRef: { type: Schema.Types.ObjectId, ref: "Address", default: null },
    driverId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    driverLocation: { type: DriverLocationSchema, default: null },
    status: { type: String, enum: ["PENDING", "PROCESSING", "SHIPPING", "DELIVERED", "CANCELLED"], default: "PENDING" },
    paymentMethod: { type: String, required: true },
    paymentStatus: { type: String, enum: ["PENDING", "CONFIRMED"], default: "PENDING" },
    cashSettlement: { type: new Schema<ICashSettlement>({
      requestId: { type: String, required: true },
      driver: { type: Schema.Types.ObjectId, ref: "User", required: true },
      actor: { type: Schema.Types.ObjectId, ref: "User", required: true },
      amount: { type: Number, required: true, min: 0 },
      currency: { type: Schema.Types.ObjectId, ref: "Currency", required: true },
      at: { type: Date, required: true },
      note: { type: String },
    }, { _id: false }), default: null },
    address: { type: String, required: true },
    driverRating: { type: Number, default: null, min: 1, max: 5 },
    driverRatedAt: { type: Date, default: null },
    lat: { type: Number },
    lng: { type: Number },
    notes: { type: String },
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, required: true },
    deliveryDistanceKm: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    couponCode: { type: String },
    couponCodes: { type: [String], default: [] },
    couponDiscount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    rewardApplied: { type: Boolean, default: false },
    statusHistory: { type: [StatusEntrySchema], default: [] },
  },
  { timestamps: true, optimisticConcurrency: true }
);

OrderSchema.index({ "refunds.settlementStatus": 1 });
OrderSchema.index({ branchId: 1, paymentMethod: 1, status: 1, paymentStatus: 1, driverId: 1 });
OrderSchema.index({ branchId: 1, "cashSettlement.at": -1 });

notificationOutbox(OrderSchema, "order");

export const Order = mongoose.model<IOrder>("Order", OrderSchema);
