import { catchAsync } from "../utils/catchAsync";
import { categorySchema } from "../validators/categoryValidators";
import { Category } from "../models/Category";
import { sendSuccess } from "../utils/response";

export const getCategories = catchAsync(async (_req, res) => {
  const categories = await Category.find();
  sendSuccess(res, categories);
});

export const createCategory = catchAsync(async (req, res) => {
  const payload = categorySchema.parse(req.body);
  const category = await Category.create(payload);
  sendSuccess(res, category, "Category created", 201);
});

export const updateCategory = catchAsync(async (req, res) => {
  const payload = categorySchema.partial().parse(req.body);
  const category = await Category.findByIdAndUpdate(req.params.id, payload, { new: true });
  if (!category) return res.status(404).json({ success: false, message: "Category not found" });
  sendSuccess(res, category, "Category updated");
});

export const deleteCategory = catchAsync(async (req, res) => {
  const deleted = await Category.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ success: false, message: "Category not found" });
  sendSuccess(res, deleted, "Category deleted");
});
