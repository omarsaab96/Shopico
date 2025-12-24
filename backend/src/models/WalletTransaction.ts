import mongoose, { Document, Schema } from "mongoose";

export interface IWalletTransaction extends Document {
  user: mongoose.Types.ObjectId;
  amount: number;
  type: "CREDIT" | "DEBIT";
  source: string;
  reference?: string;
  balanceAfter: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const WalletTransactionSchema = new Schema<IWalletTransaction>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ["CREDIT", "DEBIT"], required: true },
    source: { type: String, required: true },
    reference: { type: String },
    balanceAfter: { type: Number, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const WalletTransaction = mongoose.model<IWalletTransaction>("WalletTransaction", WalletTransactionSchema);
