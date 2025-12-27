import { Schema, model, Types } from "mongoose";

export interface AddressDoc {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  label: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema<AddressDoc>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    label: { type: String, required: true },
    address: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    phone: { type: String },
  },
  { timestamps: true }
);

export const Address = model<AddressDoc>("Address", addressSchema);
