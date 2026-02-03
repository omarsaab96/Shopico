import { catchAsync } from "../utils/catchAsync";
import {
  assignDriverSchema,
  createOrderSchema,
  driverLocationSchema,
  driverStatusSchema,
  updateOrderStatusSchema,
} from "../validators/orderValidators";
import {
  assignDriverToOrder,
  createOrder,
  getAllOrders,
  getOrderById,
  getOrdersForUser,
  getOrdersForDriver,
  updateOrderDriverLocation,
  updateOrderStatus,
  updateOrderStatusAsDriver,
} from "../services/orderService";
import { sendSuccess } from "../utils/response";
import { AuthRequest } from "../types/auth";

export const listOrders = catchAsync(async (req: AuthRequest, res) => {
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const orders = await getOrdersForUser(req.user!._id, req.branchId);
  sendSuccess(res, orders);
});

export const listDriverOrders = catchAsync(async (req: AuthRequest, res) => {
  const orders = await getOrdersForDriver(req.user!._id);
  sendSuccess(res, orders);
});

export const listOrdersAdmin = catchAsync(async (req, res) => {
  const { q, status, paymentStatus } = req.query as { q?: string; status?: string; paymentStatus?: string };
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const orders = await getAllOrders({ q, status, paymentStatus, branchId: req.branchId });
  sendSuccess(res, orders);
});

export const getOrder = catchAsync(async (req: AuthRequest, res) => {
  const branchId = req.branchId;
  const order = await getOrderById(req.params.id, req.user?.role === "customer" ? req.user._id : undefined, branchId);
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });
  sendSuccess(res, order);
});

export const createOrderHandler = catchAsync(async (req: AuthRequest, res) => {
  const payload = createOrderSchema.parse(req.body);
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const order = await createOrder(req.user!._id, req.branchId, payload);
  sendSuccess(res, order, "Order created", 201);
});

export const adminUpdateOrder = catchAsync(async (req, res) => {
  const payload = updateOrderStatusSchema.parse(req.body);
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const order = await updateOrderStatus(req.params.id, payload.status, payload.paymentStatus, req.branchId);
  sendSuccess(res, order, "Order updated");
});

export const assignDriver = catchAsync(async (req: AuthRequest, res) => {
  const payload = assignDriverSchema.parse(req.body);
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const order = await assignDriverToOrder(req.params.id, payload.driverId, req.branchId);
  sendSuccess(res, order, "Driver assigned");
});

export const updateDriverLocation = catchAsync(async (req: AuthRequest, res) => {
  const payload = driverLocationSchema.parse(req.body);
  const isPrivileged = ["admin", "manager", "staff", "driver"].includes(req.user?.role || "");
  const order = await updateOrderDriverLocation(req.params.id, req.user!._id, payload.lat, payload.lng, isPrivileged);
  sendSuccess(res, order, "Driver location updated");
});

export const updateDriverStatus = catchAsync(async (req: AuthRequest, res) => {
  const payload = driverStatusSchema.parse(req.body);
  const order = await updateOrderStatusAsDriver(req.params.id, req.user!._id, payload.status);
  sendSuccess(res, order, "Order updated");
});
