import mongoose, { Document, Schema } from "mongoose";

export interface IPointsTransaction extends Document {
  user: mongoose.Types.ObjectId;
  points: number;
  type: "EARN" | "REDEEM";
  reference?: string;
  createdAt: Date;
}

const PointsTransactionSchema = new Schema<IPointsTransaction>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    points: { type: Number, required: true },
    type: { type: String, enum: ["EARN", "REDEEM"], required: true },
    reference: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const PointsTransaction = mongoose.model<IPointsTransaction>("PointsTransaction", PointsTransactionSchema);
