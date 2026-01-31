import { Branch } from "../models/Branch";
import { branchSchema } from "../validators/branchValidators";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/response";
import { haversineDistanceKm } from "../utils/pricing";

export const getBranches = catchAsync(async (req, res) => {
  const { q } = req.query as { q?: string };
  const filter: Record<string, unknown> = {};
  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { address: { $regex: q, $options: "i" } },
      { phone: { $regex: q, $options: "i" } },
    ];
  }
  const branches = await Branch.find(filter).sort({ createdAt: -1 });
  sendSuccess(res, branches);
});

export const getMyBranches = catchAsync(async (req, res) => {
  const branchIds = (req.user as any)?.branchIds || [];
  const branches = await Branch.find({ _id: { $in: branchIds } }).sort({ createdAt: 1 });
  sendSuccess(res, branches);
});

export const createBranch = catchAsync(async (req, res) => {
  const payload = branchSchema.parse(req.body);
  const branch = await Branch.create(payload);
  sendSuccess(res, branch, "Branch created", 201);
});

export const updateBranch = catchAsync(async (req, res) => {
  const payload = branchSchema.partial().parse(req.body);
  const branch = await Branch.findByIdAndUpdate(req.params.id, payload, { new: true });
  if (!branch) return res.status(404).json({ success: false, message: "Branch not found" });
  sendSuccess(res, branch, "Branch updated");
});

export const deleteBranch = catchAsync(async (req, res) => {
  const deleted = await Branch.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ success: false, message: "Branch not found" });
  sendSuccess(res, deleted, "Branch deleted");
});

export const getNearestBranch = catchAsync(async (req, res) => {
  const { lat: rawLat, lng: rawLng } = req.query as { lat?: string; lng?: string };
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ success: false, message: "Valid lat and lng are required" });
  }
  const branches = await Branch.find({ isActive: true }).select("name address lat lng phone deliveryRadiusKm isActive");
  if (branches.length === 0) {
    return res.status(404).json({ success: false, message: "No active branches" });
  }
  let nearest = branches[0];
  let minDistance = haversineDistanceKm(lat, lng, nearest.lat, nearest.lng);
  for (const branch of branches.slice(1)) {
    const distance = haversineDistanceKm(lat, lng, branch.lat, branch.lng);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = branch;
    }
  }
  return sendSuccess(res, { branch: nearest, distanceKm: minDistance });
});

export const getPublicBranches = catchAsync(async (_req, res) => {
  const branches = await Branch.find({ isActive: true })
    .select("name address lat lng phone deliveryRadiusKm isActive")
    .sort({ createdAt: 1 });
  return sendSuccess(res, branches);
});
