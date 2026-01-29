import { catchAsync } from "../utils/catchAsync";
import { updateCartSchema } from "../validators/cartValidators";
import { getUserCart, updateCart } from "../services/cartService";
import { sendSuccess } from "../utils/response";
import { AuthRequest } from "../types/auth";

export const getCart = catchAsync(async (req: AuthRequest, res) => {
  const cart = await getUserCart(req.user!._id);
  sendSuccess(res, cart);
});

export const saveCart = catchAsync(async (req: AuthRequest, res) => {
  const payload = updateCartSchema.parse(req.body);
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const cart = await updateCart(req.user!._id, req.branchId, payload.items);
  sendSuccess(res, cart, "Cart updated");
});
