import mongoose, { Document, Schema } from "mongoose";

export interface ICategory extends Document {
  name: string;
  description?: string;
  imageUrl?: string;
  branchId: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true },
    description: { type: String },
    imageUrl: { type: String },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
  },
  { timestamps: true }
);

CategorySchema.index({ branchId: 1, name: 1 }, { unique: true });

export const Category = mongoose.model<ICategory>("Category", CategorySchema);
