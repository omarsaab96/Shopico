import { Types } from "mongoose";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/response";
import { AuthRequest } from "../types/auth";
import { addressSchema, addressUpdateSchema } from "../validators/addressValidators";
import { listAddresses, createAddress, updateAddress, deleteAddress } from "../services/addressService";

export const listAddressHandler = catchAsync(async (req: AuthRequest, res) => {
  const addresses = await listAddresses(req.user!._id as Types.ObjectId);
  sendSuccess(res, addresses);
});

export const createAddressHandler = catchAsync(async (req: AuthRequest, res) => {
  const payload = addressSchema.parse(req.body);
  const address = await createAddress(req.user!._id as Types.ObjectId, payload);
  sendSuccess(res, address, "Address created", 201);
});

export const updateAddressHandler = catchAsync(async (req: AuthRequest, res) => {
  const payload = addressUpdateSchema.parse(req.body);
  const address = await updateAddress(req.user!._id as Types.ObjectId, req.params.id, payload);
  sendSuccess(res, address, "Address updated");
});

export const deleteAddressHandler = catchAsync(async (req: AuthRequest, res) => {
  await deleteAddress(req.user!._id as Types.ObjectId, req.params.id);
  sendSuccess(res, null, "Address deleted");
});
