import mongoose, { Document, Schema, Types } from "mongoose";

export interface IBannerImage {
  url: string;
  fileId: string;
}

export interface IBanner extends Document {
  title?: string;
  description?: string;
  link?: string;
  image?: IBannerImage;
  startsAt: Date;
  endsAt: Date;
  isEnabled: boolean;
  branchId: Types.ObjectId | string;
  createdAt: Date;
  updatedAt: Date;
}

const BannerImageSchema = new Schema<IBannerImage>(
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

const BannerSchema = new Schema<IBanner>(
  {
    title: { type: String },
    description: { type: String },
    link: { type: String },
    image: { type: BannerImageSchema, required: true },
    startsAt: { type: Date, default: defaultStartsAt },
    endsAt: { type: Date, default: defaultEndsAt },
    isEnabled: { type: Boolean, default: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
  },
  { timestamps: true }
);

export const Banner = mongoose.model<IBanner>("Banner", BannerSchema, "banners");
