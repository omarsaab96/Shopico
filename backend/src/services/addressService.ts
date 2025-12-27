import { Types } from "mongoose";
import { Address } from "../models/Address";

export const listAddresses = async (userId: Types.ObjectId) => {
  return Address.find({ user: userId }).sort({ createdAt: -1 });
};

export const createAddress = async (
  userId: Types.ObjectId,
  payload: { label: string; address: string; lat: number; lng: number; phone?: string }
) => {
  return Address.create({ ...payload, user: userId });
};

export const updateAddress = async (
  userId: Types.ObjectId,
  id: string,
  payload: Partial<{ label: string; address: string; lat: number; lng: number; phone?: string }>
) => {
  const address = await Address.findOneAndUpdate({ _id: id, user: userId }, payload, { new: true });
  if (!address) throw { status: 404, message: "Address not found" };
  return address;
};

export const deleteAddress = async (userId: Types.ObjectId, id: string) => {
  const res = await Address.findOneAndDelete({ _id: id, user: userId });
  if (!res) throw { status: 404, message: "Address not found" };
};
