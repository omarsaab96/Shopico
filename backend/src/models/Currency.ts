import mongoose, { Document, Schema, Types } from "mongoose";

export interface ICurrency extends Document {
  branchId: Types.ObjectId | string;
  symbol: {
    en: string;
    ar?: string;
  };
  exchangeRate: number;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CurrencySchema = new Schema<ICurrency>(
  {
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    symbol: {
      en: { type: String, required: true, trim: true },
      ar: { type: String, trim: true },
    },
    exchangeRate: { type: Number, required: true, min: 0 },
    isPrimary: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CurrencySchema.index({ branchId: 1, "symbol.en": 1 }, { unique: true });
CurrencySchema.index({ branchId: 1, isPrimary: 1 });

export const Currency = mongoose.model<ICurrency>("Currency", CurrencySchema);
