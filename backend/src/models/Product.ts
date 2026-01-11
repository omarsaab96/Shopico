import mongoose, { Document, Schema } from "mongoose";

export interface IProductImage {
  url: string;
  fileId: string;
}

export interface IProduct extends Document {
  name: string;
  description?: string;
  price: number;
  promoPrice?: number;
  isPromoted: boolean;
  categories: mongoose.Types.ObjectId[];
  images: IProductImage[];
  isAvailable: boolean;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductImageSchema = new Schema<IProductImage>(
  {
    url: { type: String, required: true },
    fileId: { type: String, required: true },
  },
  { _id: false }
);

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    promoPrice: { type: Number },
    isPromoted: { type: Boolean, default: false },
    categories: { type: [Schema.Types.ObjectId], ref: "Category", default: [] },
    images: { type: [ProductImageSchema], default: [] },
    isAvailable: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Product = mongoose.model<IProduct>("Product", ProductSchema);
