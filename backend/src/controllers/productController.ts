import { catchAsync } from "../utils/catchAsync";
import { Product } from "../models/Product";
import { bulkPriceSchema, productSchema, productUpdateSchema } from "../validators/productValidators";
import { sendSuccess } from "../utils/response";
import { AuditLog } from "../models/AuditLog";
import { AuthRequest } from "../types/auth";
import * as xlsx from "xlsx";

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

export const listAllProductsAdmin = catchAsync(async (req, res) => {
  const { q, category, includeUnavailable } = req.query as { q?: string; category?: string; includeUnavailable?: string };
  const filter: Record<string, unknown> = {};
  if (q) filter.name = { $regex: q, $options: "i" };
  if (category) filter.categories = category;
  if (!includeUnavailable || includeUnavailable !== "true") filter.isAvailable = true;

  const products = await Product.find(filter).populate("categories").sort({ createdAt: -1 });
  sendSuccess(res, products);
});

export const listProductsAdminPaginated = catchAsync(async (req, res) => {
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
  const limit = Math.min(200, Math.max(1, Number(rawLimit) || 50));
  const total = await Product.countDocuments(filter);
  const items = await Product.find(filter)
    .populate("categories")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  const hasMore = (page - 1) * limit + items.length < total;
  sendSuccess(res, { items, total, page, limit, hasMore });
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
    barcode: payload.barcode,
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

const normalizeBarcode = (value: unknown) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value));
  const raw = String(value).trim();
  if (!raw) return "";
  return raw.replace(/\s+/g, "");
};

const parseNumber = (value: unknown) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

type ImportAction = "create" | "update" | "skip";
type ImportEntry = {
  barcode: string;
  name: string;
  price: number | null;
  hasStock: boolean;
};
type ImportDecision = {
  barcode: string;
  name: string;
  price: number | null;
  hasStock: boolean;
  action: ImportAction;
  reason?: string;
};

const readImportEntries = (buffer: Buffer) => {
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [] as ImportEntry[];
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  return rows.map((row) => {
    const barcode = normalizeBarcode(row["الرمز"]);
    const name = typeof row["المادة"] === "string" ? row["المادة"].trim() : String(row["المادة"] || "").trim();
    const price = parseNumber(row["سعر 1"]);
    const stockQty = parseNumber(row["الرصيد الحالي"]);
    const hasStock = Boolean(stockQty && stockQty > 0);
    return { barcode, name, price, hasStock };
  });
};

const decideImportActions = (
  entries: ImportEntry[],
  existingMap: Map<string, { name?: string; price?: number; isAvailable?: boolean }>
) => {
  const decisions: ImportDecision[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (!entry.barcode || entry.price === null) {
      decisions.push({ ...entry, action: "skip", reason: "missing_barcode_or_price" });
      skipped += 1;
      continue;
    }
    if (!entry.name) {
      decisions.push({ ...entry, action: "skip", reason: "missing_name" });
      skipped += 1;
      continue;
    }
    const existing = existingMap.get(entry.barcode);
    const exists = Boolean(existing);
    if (!exists && !entry.hasStock) {
      decisions.push({ ...entry, action: "skip", reason: "no_stock_new" });
      skipped += 1;
      continue;
    }
    if (!exists) {
      decisions.push({ ...entry, action: "create" });
      created += 1;
      continue;
    }

    const desired = {
      name: entry.name,
      price: entry.price ?? undefined,
      isAvailable: entry.hasStock,
    };
    const hasChange =
      desired.name !== existing?.name ||
      desired.price !== existing?.price ||
      desired.isAvailable !== existing?.isAvailable;

    if (!hasChange) {
      decisions.push({ ...entry, action: "skip", reason: "no_change" });
      skipped += 1;
      continue;
    }

    decisions.push({ ...entry, action: "update" });
    updated += 1;
  }

  return { decisions, created, updated, skipped };
};

export const previewProductsImport = catchAsync(async (req: AuthRequest, res) => {
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ success: false, message: "File is required" });

  const entries = readImportEntries(file.buffer);
  if (entries.length === 0) {
    return res.status(400).json({ success: false, message: "No rows found" });
  }

  const barcodes = entries.map((entry) => entry.barcode).filter(Boolean);
  const existing = await Product.find({ barcode: { $in: barcodes } })
    .select("barcode name price isAvailable")
    .lean();
  const existingMap = new Map(existing.map((p) => [p.barcode, { name: p.name, price: p.price, isAvailable: p.isAvailable }]));

  const { decisions, created, updated, skipped } = decideImportActions(entries, existingMap);
  const preview = decisions.slice(0, 50);
  sendSuccess(res, { preview, created, updated, skipped, total: entries.length });
});

export const importProductsFromExcel = catchAsync(async (req: AuthRequest, res) => {
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ success: false, message: "File is required" });

  const entries = readImportEntries(file.buffer);
  if (entries.length === 0) {
    return res.status(400).json({ success: false, message: "No rows found" });
  }

  const barcodes = entries.map((entry) => entry.barcode).filter(Boolean);
  const existing = await Product.find({ barcode: { $in: barcodes } })
    .select("barcode name price isAvailable")
    .lean();
  const existingMap = new Map(existing.map((p) => [p.barcode, { name: p.name, price: p.price, isAvailable: p.isAvailable }]));

  const { decisions, created, updated, skipped } = decideImportActions(entries, existingMap);
  const ops = [];

  for (const decision of decisions) {
    if (decision.action === "skip") continue;

    const update: Record<string, unknown> = {
      name: decision.name,
      price: decision.price,
      isAvailable: decision.hasStock,
    };

    ops.push({
      updateOne: {
        filter: { barcode: decision.barcode },
        update: {
          $set: update,
          $setOnInsert: {
            barcode: decision.barcode,
            description: undefined,
            promoPrice: undefined,
            isPromoted: false,
            isFeatured: false,
            categories: [],
            images: [],
          },
        },
        upsert: true,
      },
    });
  }

  if (ops.length === 0) {
    return res.status(200).json({ success: true, message: "No changes", data: { created, updated, skipped } });
  }

  await Product.bulkWrite(ops, { ordered: false });
  await AuditLog.create({
    user: req.user?._id,
    action: "PRODUCTS_IMPORT",
    metadata: { created, updated, skipped, total: entries.length },
  });
  sendSuccess(res, { created, updated, skipped, total: entries.length }, "Products imported");
});
