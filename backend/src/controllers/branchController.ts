import { Branch } from "../models/Branch";
import { branchSchema } from "../validators/branchValidators";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/response";

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
