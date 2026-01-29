import { catchAsync } from "../utils/catchAsync";
import { categorySchema } from "../validators/categoryValidators";
import { Category } from "../models/Category";
import { sendSuccess } from "../utils/response";
import { getDefaultBranchId } from "../utils/branch";

export const getCategories = catchAsync(async (req, res) => {
  const { q } = req.query as { q?: string };
  const branchId = req.branchId || (await getDefaultBranchId());
  if (!branchId) return res.status(400).json({ success: false, message: "Branch not configured" });
  const filter: Record<string, unknown> = {};
  filter.branchId = branchId;
  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
    ];
  }
  const categories = await Category.find(filter);
  sendSuccess(res, categories);
});

export const createCategory = catchAsync(async (req, res) => {
  const payload = categorySchema.parse(req.body);
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const category = await Category.create({ ...payload, branchId: req.branchId });
  sendSuccess(res, category, "Category created", 201);
});

export const updateCategory = catchAsync(async (req, res) => {
  const payload = categorySchema.partial().parse(req.body);
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const category = await Category.findOneAndUpdate(
    { _id: req.params.id, branchId: req.branchId },
    payload,
    { new: true }
  );
  if (!category) return res.status(404).json({ success: false, message: "Category not found" });
  sendSuccess(res, category, "Category updated");
});

export const deleteCategory = catchAsync(async (req, res) => {
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const deleted = await Category.findOneAndDelete({ _id: req.params.id, branchId: req.branchId });
  if (!deleted) return res.status(404).json({ success: false, message: "Category not found" });
  sendSuccess(res, deleted, "Category deleted");
});
