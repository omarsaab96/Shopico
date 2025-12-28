import { catchAsync } from "../utils/catchAsync";
import { Product } from "../models/Product";
import { productSchema } from "../validators/productValidators";
import { sendSuccess } from "../utils/response";

export const listProducts = catchAsync(async (req, res) => {
  const { q, category, page: rawPage, limit: rawLimit } = req.query as { q?: string; category?: string; page?: string; limit?: string };
  const filter: Record<string, unknown> = {};
  if (q) filter.name = { $regex: q, $options: "i" };
  if (category) filter.category = category;

  const page = Math.max(1, Number(rawPage) || 1);
  const limit = Math.min(100, Math.max(1, Number(rawLimit) || 20));
  const shouldPaginate = Boolean(rawPage) || Boolean(rawLimit);

  if (shouldPaginate) {
    const total = await Product.countDocuments(filter);
    const items = await Product.find(filter)
      .populate("category")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    const hasMore = (page - 1) * limit + items.length < total;
    return sendSuccess(res, { items, total, page, limit, hasMore });
  }

  const products = await Product.find(filter).populate("category").limit(100);
  sendSuccess(res, products);
});

export const getProduct = catchAsync(async (req, res) => {
  const product = await Product.findById(req.params.id).populate("category");
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });
  sendSuccess(res, product);
});

export const createProduct = catchAsync(async (req, res) => {
  const payload = productSchema.parse(req.body);
  const product = await Product.create({
    name: payload.name,
    description: payload.description,
    price: payload.price,
    category: payload.category,
    images: payload.images,
    stock: payload.stock ?? 0,
    isFeatured: payload.isFeatured ?? false,
  });
  sendSuccess(res, product, "Product created", 201);
});

export const updateProduct = catchAsync(async (req, res) => {
  const payload = productSchema.partial().parse(req.body);
  const product = await Product.findByIdAndUpdate(req.params.id, payload, { new: true });
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });
  sendSuccess(res, product, "Product updated");
});

export const deleteProduct = catchAsync(async (req, res) => {
  const deleted = await Product.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ success: false, message: "Product not found" });
  sendSuccess(res, deleted, "Product deleted");
});
