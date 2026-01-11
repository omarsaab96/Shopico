import { catchAsync } from "../utils/catchAsync";
import { Product } from "../models/Product";
import { bulkPriceSchema, productSchema, productUpdateSchema } from "../validators/productValidators";
import { sendSuccess } from "../utils/response";

export const listProducts = catchAsync(async (req, res) => {
  const {
    q,
    category,
    page: rawPage,
    limit: rawLimit,
    includeUnavailable,
  } = req.query as { q?: string; category?: string; page?: string; limit?: string; includeUnavailable?: string };
  const filter: Record<string, unknown> = {};
  if (q) filter.name = { $regex: q, $options: "i" };
  if (category) filter.categories = category;
  if (!includeUnavailable || includeUnavailable !== "true") filter.isAvailable = true;

  const page = Math.max(1, Number(rawPage) || 1);
  const limit = Math.min(100, Math.max(1, Number(rawLimit) || 20));
  const shouldPaginate = Boolean(rawPage) || Boolean(rawLimit);

  if (shouldPaginate) {
    const total = await Product.countDocuments(filter);
    const items = await Product.find(filter)
      .populate("categories")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    const hasMore = (page - 1) * limit + items.length < total;
    return sendSuccess(res, { items, total, page, limit, hasMore });
  }

  const products = await Product.find(filter).populate("categories").limit(100);
  sendSuccess(res, products);
});

export const getProduct = catchAsync(async (req, res) => {
  const product = await Product.findById(req.params.id).populate("categories");
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });
  sendSuccess(res, product);
});

export const createProduct = catchAsync(async (req, res) => {
  const payload = productSchema.parse(req.body);
  const product = await Product.create({
    name: payload.name,
    description: payload.description,
    price: payload.price,
    promoPrice: payload.promoPrice,
    isPromoted: payload.isPromoted ?? false,
    categories: payload.categories,
    images: payload.images,
    isAvailable: payload.isAvailable ?? true,
    isFeatured: payload.isFeatured ?? false,
  });
  sendSuccess(res, product, "Product created", 201);
});

export const updateProduct = catchAsync(async (req, res) => {
  const payload = productUpdateSchema.partial().parse(req.body);
  const product = await Product.findByIdAndUpdate(req.params.id, payload, { new: true });
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });
  sendSuccess(res, product, "Product updated");
});

export const deleteProduct = catchAsync(async (req, res) => {
  const deleted = await Product.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ success: false, message: "Product not found" });
  sendSuccess(res, deleted, "Product deleted");
});

export const bulkUpdatePrices = catchAsync(async (req, res) => {
  const payload = bulkPriceSchema.parse(req.body);
  if (payload.amountType === "PERCENT" && payload.mode === "DISCOUNT" && payload.amount > 100) {
    return res.status(400).json({ success: false, message: "Percentage discount cannot exceed 100" });
  }

  const isPercent = payload.amountType === "PERCENT";
  const amountValue = payload.amount;
  const multiplier = isPercent ? amountValue / 100 : null;

  const rawPrice = isPercent
    ? {
        $multiply: [
          "$price",
          payload.mode === "INCREASE"
            ? { $add: [1, multiplier] }
            : { $subtract: [1, multiplier] },
        ],
      }
    : payload.mode === "INCREASE"
      ? { $add: ["$price", amountValue] }
      : { $subtract: ["$price", amountValue] };

  const price = payload.mode === "DISCOUNT" ? { $max: [0, rawPrice] } : rawPrice;

  const result = await Product.updateMany({}, [{ $set: { price } }], { updatePipeline: true });
  const modifiedCount = (result as any).modifiedCount ?? (result as any).nModified ?? 0;
  sendSuccess(res, { modifiedCount }, "Prices updated");
});
