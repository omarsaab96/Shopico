import mongoose, { Document, Schema } from "mongoose";

export interface IPromotionImage {
  url: string;
  fileId: string;
}

export interface IPromotion extends Document {
  title?: string;
  description?: string;
  link?: string;
  image?: IPromotionImage;
  startsAt: Date;
  endsAt: Date;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PromotionImageSchema = new Schema<IPromotionImage>(
  {
    url: { type: String, required: true },
    fileId: { type: String, required: true },
  },
  { _id: false }
);

const defaultStartsAt = () => new Date();
const defaultEndsAt = () => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date;
};

const PromotionSchema = new Schema<IPromotion>(
  {
    title: { type: String },
    description: { type: String },
    link: { type: String },
    image: { type: PromotionImageSchema },
    startsAt: { type: Date, default: defaultStartsAt },
    endsAt: { type: Date, default: defaultEndsAt },
    isEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Promotion = mongoose.model<IPromotion>("Promotion", PromotionSchema);
