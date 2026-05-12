import mongoose, { Document, Schema, Types } from "mongoose";

export interface IWallet extends Document {
  user: Types.ObjectId | string;
  balance: number;
  balances: {
    currency: Types.ObjectId | string;
    amount: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const WalletBalanceSchema = new Schema(
  {
    currency: { type: Schema.Types.ObjectId, ref: "Currency", required: true },
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

const WalletSchema = new Schema<IWallet>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", unique: true, required: true },
    balance: { type: Number, default: 0 },
    balances: { type: [WalletBalanceSchema], default: [] },
  },
  { timestamps: true }
);

export const Wallet = mongoose.model<IWallet>("Wallet", WalletSchema);
