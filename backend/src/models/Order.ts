import mongoose, { Document, Schema, Types } from "mongoose";
import { OrderStatus, PaymentMethod } from "../types";

export interface IOrderItem {
  product: Types.ObjectId | string;
  quantity: number;
  price: number;
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

export interface IOrder extends Document {
  user: Types.ObjectId | string;
  items: IOrderItem[];
  branchId: Types.ObjectId | string;
  driverId?: Types.ObjectId | string;
  driverLocation?: IOrderDriverLocation | null;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: "PENDING" | "CONFIRMED";
  address: string;
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
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
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
    driverId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    driverLocation: { type: DriverLocationSchema, default: null },
    status: { type: String, enum: ["PENDING", "PROCESSING", "SHIPPING", "DELIVERED", "CANCELLED"], default: "PENDING" },
    paymentMethod: { type: String, required: true },
    paymentStatus: { type: String, enum: ["PENDING", "CONFIRMED"], default: "PENDING" },
    address: { type: String, required: true },
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
  { timestamps: true }
);

export const Order = mongoose.model<IOrder>("Order", OrderSchema);
