import mongoose, { Document, Schema } from "mongoose";
import { notificationOutbox } from "../notifications/outbox";

export interface IRewardToken extends Document {
  user: mongoose.Types.ObjectId;
  consumed: boolean;
  createdAt: Date;
}

const RewardTokenSchema = new Schema<IRewardToken>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    consumed: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationOutbox(RewardTokenSchema, "reward");
export const RewardToken = mongoose.model<IRewardToken>("RewardToken", RewardTokenSchema);
