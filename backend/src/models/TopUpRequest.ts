import mongoose, { Document, Schema } from "mongoose";
import { TopUpMethod, TopUpStatus } from "../types";

export interface ITopUpRequest extends Document {
  user: mongoose.Types.ObjectId;
  method: TopUpMethod;
  amount: number;
  status: TopUpStatus;
  note?: string;
  adminNote?: string;
  branchId: Schema.Types.ObjectId;
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
