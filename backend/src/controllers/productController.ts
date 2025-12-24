import { catchAsync } from "../utils/catchAsync";
import { Product } from "../models/Product";
import { productSchema } from "../validators/productValidators";
import { sendSuccess } from "../utils/response";

export const listProducts = catchAsync(async (req, res) => {
  const { q, category } = req.query as { q?: string; category?: string };
  const filter: Record<string, unknown> = {};
  if (q) filter.name = { $regex: q, $options: "i" };
  if (category) filter.category = category;
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
