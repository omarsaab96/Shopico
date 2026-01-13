import mongoose, { Document, Schema } from "mongoose";
import { OrderStatus, PaymentMethod } from "../types";

export interface IOrderItem {
  product: mongoose.Types.ObjectId;
  quantity: number;
  price: number;
}

export interface IOrderStatusEntry {
  status: OrderStatus;
  at: Date;
}

export interface IOrder extends Document {
  user: mongoose.Types.ObjectId;
  items: IOrderItem[];
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: "PENDING" | "CONFIRMED";
  address: string;
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

const OrderSchema = new Schema<IOrder>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: { type: [OrderItemSchema], required: true },
    status: { type: String, enum: ["PENDING", "PROCESSING", "SHIPPING", "DELIVERED", "CANCELLED"], default: "PENDING" },
    paymentMethod: { type: String, required: true },
    paymentStatus: { type: String, enum: ["PENDING", "CONFIRMED"], default: "PENDING" },
    address: { type: String, required: true },
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
