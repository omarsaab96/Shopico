import { Schema, model, Types } from "mongoose";

export interface BranchDoc {
  _id: Types.ObjectId;
  name: string;
  address: string;
  phone?: string;
  lat: number;
  lng: number;
  openHours?: string;
  deliveryRadiusKm: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const branchSchema = new Schema<BranchDoc>(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    openHours: { type: String, trim: true },
    deliveryRadiusKm: { type: Number, default: 5 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Branch = model<BranchDoc>("Branch", branchSchema);
