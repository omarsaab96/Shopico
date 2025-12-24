import mongoose, { Document, Schema } from "mongoose";
import { UserRole } from "../types";

export interface IUser extends Document {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: UserRole;
  membershipLevel: string;
  membershipGraceUntil?: Date | null;
  points: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    phone: { type: String },
    password: { type: String, required: true },
    role: { type: String, enum: ["customer", "admin", "staff"], default: "customer" },
    membershipLevel: { type: String, default: "None" },
    membershipGraceUntil: { type: Date, default: null },
    points: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", UserSchema);
