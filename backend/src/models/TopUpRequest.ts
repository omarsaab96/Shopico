import mongoose, { Document, Schema, Types } from "mongoose";
import { TopUpMethod, TopUpStatus } from "../types";

export interface ITopUpRequest extends Document {
  user: Types.ObjectId | string;
  method: TopUpMethod;
  amount: number;
  status: TopUpStatus;
  note?: string;
  adminNote?: string;
  branchId: Types.ObjectId | string;
  createdAt: Date;
  updatedAt: Date;
}

const TopUpRequestSchema = new Schema<ITopUpRequest>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    method: { type: String, enum: ["CASH_STORE", "SHAM_CASH", "BANK_TRANSFER"], required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING" },
    note: { type: String },
    adminNote: { type: String },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
  },
  { timestamps: true }
);

export const TopUpRequest = mongoose.model<ITopUpRequest>("TopUpRequest", TopUpRequestSchema);
