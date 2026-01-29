import { catchAsync } from "../utils/catchAsync";
import { Product } from "../models/Product";
import { bulkPriceSchema, productSchema, productUpdateSchema } from "../validators/productValidators";
import { sendSuccess } from "../utils/response";
import { AuditLog } from "../models/AuditLog";
import { AuthRequest } from "../types/auth";
import * as xlsx from "xlsx";
import { getDefaultBranchId } from "../utils/branch";

export const listProducts = catchAsync(async (req, res) => {
  const {
    q,
    category,
    page: rawPage,
    limit: rawLimit,
    includeUnavailable,
  } = req.query as { q?: string; category?: string; page?: string; limit?: string; includeUnavailable?: string };
  const branchId = req.branchId || (await getDefaultBranchId());
  if (!branchId) return res.status(400).json({ success: false, message: "Branch not configured" });
  const filter: Record<string, unknown> = { branchId };
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
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const filter: Record<string, unknown> = { branchId: req.branchId };
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
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const filter: Record<string, unknown> = { branchId: req.branchId };
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
  const branchId = req.branchId || (await getDefaultBranchId());
  if (!branchId) return res.status(400).json({ success: false, message: "Branch not configured" });
  const product = await Product.findOne({ _id: req.params.id, branchId }).populate("categories");
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });
  sendSuccess(res, product);
});

export const createProduct = catchAsync(async (req, res) => {
  const payload = productSchema.parse(req.body);
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
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
    branchId: req.branchId,
  });
  sendSuccess(res, product, "Product created", 201);
});

export const updateProduct = catchAsync(async (req, res) => {
  const payload = productUpdateSchema.partial().parse(req.body);
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const product = await Product.findOneAndUpdate({ _id: req.params.id, branchId: req.branchId }, payload, { new: true });
  if (!product) return res.status(404).json({ success: false, message: "Product not found" });
  sendSuccess(res, product, "Product updated");
});

export const deleteProduct = catchAsync(async (req, res) => {
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const deleted = await Product.findOneAndDelete({ _id: req.params.id, branchId: req.branchId });
  if (!deleted) return res.status(404).json({ success: false, message: "Product not found" });
  sendSuccess(res, deleted, "Product deleted");
});

export const bulkUpdatePrices = catchAsync(async (req, res) => {
  const payload = bulkPriceSchema.parse(req.body);
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
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

  const result = await Product.updateMany({ branchId: req.branchId }, [{ $set: { price } }], { updatePipeline: true });
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
  reasonDetail?: string;
  previousName?: string;
  previousPrice?: number;
  previousHasStock?: boolean;
};

const readImportEntries = (buffer: Buffer) => {
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [] as ImportEntry[];
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json<unknown[]>(sheet, { defval: null, header: 1, raw: true });
  if (rows.length === 0) return [] as ImportEntry[];

  const normalizeHeader = (value: unknown) =>
    String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

  const headerLabels = {
    barcode: ["\u0627\u0644\u0631\u0645\u0632"],
    name: ["\u0627\u0644\u0645\u0627\u062f\u0629"],
    price: ["\u0633\u0639\u0631"],
    stock: ["\u0627\u0644\u0631\u0635\u064a\u062f"],
  };

  let headerRowIndex = -1;
  let headerRow: string[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const normalized = row.map((cell) => normalizeHeader(cell));
    const hasBarcode = normalized.some((cell) => headerLabels.barcode.some((label) => cell.includes(normalizeHeader(label))));
    const hasName = normalized.some((cell) => headerLabels.name.some((label) => cell.includes(normalizeHeader(label))));
    const hasPrice = normalized.some((cell) => headerLabels.price.some((label) => cell.includes(normalizeHeader(label))));
    if (hasBarcode && hasName && hasPrice) {
      headerRowIndex = i;
      headerRow = normalized;
      break;
    }
  }

  if (headerRowIndex === -1) return [] as ImportEntry[];

  const getIndex = (labels: string[]) =>
    headerRow.findIndex((cell) => labels.some((label) => cell.includes(normalizeHeader(label))));

  const barcodeIndex = getIndex(headerLabels.barcode);
  const nameIndex = getIndex(headerLabels.name);
  const priceIndex = getIndex(headerLabels.price);
  const stockIndex = getIndex(headerLabels.stock);

  const entries: ImportEntry[] = [];
  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    const rawBarcode = barcodeIndex >= 0 ? row[barcodeIndex] : null;
    const rawName = nameIndex >= 0 ? row[nameIndex] : null;
    const rawPrice = priceIndex >= 0 ? row[priceIndex] : null;
    const rawStock = stockIndex >= 0 ? row[stockIndex] : null;

    const barcode = normalizeBarcode(rawBarcode);
    const name = typeof rawName === "string" ? rawName.trim() : String(rawName || "").trim();
    const price = parseNumber(rawPrice);
    const stockQty = parseNumber(rawStock);
    const hasStock = Boolean(stockQty && stockQty > 0);

    if (!barcode && !name && price === null && stockQty === null) {
      continue;
    }
    entries.push({ barcode, name, price, hasStock });
  }

  return entries;
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
      decisions.push({ ...entry, action: "create", reason: "new_product" });
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
      decisions.push({
        ...entry,
        action: "skip",
        reason: "no_change",
        previousName: existing?.name,
        previousPrice: existing?.price,
        previousHasStock: existing?.isAvailable,
      });
      skipped += 1;
      continue;
    }

    const changedFields: string[] = [];
    if (desired.name !== existing?.name) changedFields.push("name");
    if (desired.price !== existing?.price) changedFields.push("price");
    if (desired.isAvailable !== existing?.isAvailable) changedFields.push("availability");

    decisions.push({
      ...entry,
      action: "update",
      reason: "updated_fields",
      reasonDetail: changedFields.join(","),
      previousName: existing?.name,
      previousPrice: existing?.price,
      previousHasStock: existing?.isAvailable,
    });
    updated += 1;
  }

  return { decisions, created, updated, skipped };
};

export const previewProductsImport = catchAsync(async (req: AuthRequest, res) => {
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ success: false, message: "File is required" });
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });

  const entries = readImportEntries(file.buffer);
  if (entries.length === 0) {
    return res.status(400).json({ success: false, message: "No rows found" });
  }

  const barcodes = entries.map((entry) => entry.barcode).filter(Boolean);
  const existing = await Product.find({ barcode: { $in: barcodes }, branchId: req.branchId })
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
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });

  const entries = readImportEntries(file.buffer);
  if (entries.length === 0) {
    return res.status(400).json({ success: false, message: "No rows found" });
  }

  const barcodes = entries.map((entry) => entry.barcode).filter(Boolean);
  const existing = await Product.find({ barcode: { $in: barcodes }, branchId: req.branchId })
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
        filter: { barcode: decision.barcode, branchId: req.branchId },
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
            branchId: req.branchId,
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
