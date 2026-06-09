import mongoose, { Document, Schema, Types } from "mongoose";

export interface IProductImage {
  url: string;
  fileId: string;
}

export interface IProductVariant {
  _id?: Types.ObjectId;
  sku?: string;
  barcode?: string;
  attributes: Record<string, string>;
  price?: number;
  promoPrice?: number;
  isPromoted?: boolean;
  images?: IProductImage[];
  isAvailable?: boolean;
  isPublic?: boolean;
}

export interface IProduct extends Document {
  name: string;
  description?: string;
  barcode?: string;
  price: number;
  promoPrice?: number;
  isPromoted: boolean;
  categories: Types.ObjectId[] | string[];
  images: IProductImage[];
  variants: IProductVariant[];
  isAvailable: boolean;
  isPublic: boolean;
  isFeatured: boolean;
  branchId: Types.ObjectId | string;
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

const ProductVariantSchema = new Schema<IProductVariant>(
  {
    sku: { type: String },
    barcode: { type: String },
    attributes: { type: Schema.Types.Mixed, default: {} },
    price: { type: Number, min: 0 },
    promoPrice: { type: Number, min: 0 },
    isPromoted: { type: Boolean },
    images: { type: [ProductImageSchema], default: [] },
    isAvailable: { type: Boolean },
    isPublic: { type: Boolean },
  },
  { timestamps: false }
);

const ProductSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true },
    description: { type: String },
    barcode: { type: String, sparse: true },
    price: { type: Number, required: true },
    promoPrice: { type: Number },
    isPromoted: { type: Boolean, default: false },
    categories: { type: [Schema.Types.ObjectId], ref: "Category", default: [] },
    images: { type: [ProductImageSchema], default: [] },
    variants: { type: [ProductVariantSchema], default: [] },
    isAvailable: { type: Boolean, default: true },
    isPublic: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
  },
  { timestamps: true }
);

ProductSchema.index({ branchId: 1, barcode: 1 }, { unique: true, sparse: true });

export const findProductVariant = (product: Pick<IProduct, "variants">, variantId?: string) => {
  if (!variantId) return undefined;
  return (product.variants || []).find((variant: any) => variant._id?.toString() === variantId);
};

export const getVariantAttributes = (variant?: IProductVariant) => ({ ...(variant?.attributes || {}) });

export const getEffectiveVariantPrice = (product: IProduct, variant?: IProductVariant) => {
  const basePrice = variant?.price ?? product.price;
  const isPromoted = variant?.isPromoted ?? product.isPromoted;
  const promoPrice = variant?.promoPrice ?? product.promoPrice;
  return isPromoted && promoPrice !== undefined ? promoPrice : basePrice;
};

export const isVariantAvailable = (product: IProduct, variant?: IProductVariant) => {
  if (!variant) return product.isAvailable && product.isPublic !== false;
  const isAvailable = variant.isAvailable ?? product.isAvailable;
  const isPublic = variant.isPublic ?? product.isPublic;
  return isAvailable && isPublic !== false;
};

export const Product = mongoose.model<IProduct>("Product", ProductSchema);
