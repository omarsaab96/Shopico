import mongoose, { Document, Schema, Types } from "mongoose";
import { DriverStatus, UserRole } from "../types";

export interface IUser extends Document {
  name: string;
  email: string;
  phone?: string;
  password?: string | null;
  role: UserRole;
  driverStatus?: DriverStatus;
  permissions: string[];
  branchIds: Array<Types.ObjectId | string>;
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
    password: { type: String, required: false, default: null },
    role: { type: String, enum: ["customer", "admin", "manager", "staff", "driver"], default: "customer" },
    driverStatus: { type: String, enum: ["AVAILABLE", "BUSY"], default: "AVAILABLE" },
    permissions: { type: [String], default: [] },
    branchIds: { type: [Schema.Types.ObjectId], ref: "Branch", default: [] },
    membershipLevel: { type: String, default: "None" },
    membershipGraceUntil: { type: Date, default: null },
    points: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", UserSchema);
