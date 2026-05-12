import { Branch } from "../models/Branch";
import { Category } from "../models/Category";
import { Product } from "../models/Product";
import { Order } from "../models/Order";
import { Announcement } from "../models/Announcement";
import { Coupon } from "../models/Coupon";
import { Settings } from "../models/Settings";
import { TopUpRequest } from "../models/TopUpRequest";
import { User } from "../models/User";
import { Currency } from "../models/Currency";

export const ensureDefaultBranchSetup = async () => {
  let defaultBranch = await Branch.findOne().sort({ createdAt: 1 });
  if (!defaultBranch) {
    defaultBranch = await Branch.create({
      name: "Main Branch",
      address: "Main Branch",
      lat: 0,
      lng: 0,
      deliveryRadiusKm: 5,
      isActive: true,
    });
  }
  const branchId = defaultBranch._id;

  await Promise.all([
    Category.updateMany({ branchId: { $exists: false } }, { $set: { branchId } }),
    Product.updateMany({ branchId: { $exists: false } }, { $set: { branchId } }),
    Order.updateMany({ branchId: { $exists: false } }, { $set: { branchId } }),
    Announcement.updateMany({ branchId: { $exists: false } }, { $set: { branchId } }),
    Coupon.updateMany({ branchId: { $exists: false } }, { $set: { branchId } }),
    Settings.updateMany({ branchId: { $exists: false } }, { $set: { branchId } }),
    TopUpRequest.updateMany({ branchId: { $exists: false } }, { $set: { branchId } }),
    User.updateMany(
      { $or: [{ branchIds: { $exists: false } }, { branchIds: { $size: 0 } }] },
      { $set: { branchIds: [branchId] } }
    ),
    User.updateMany(
      { role: "admin" },
      { $addToSet: { permissions: { $each: ["currencies:view", "currencies:manage"] } } }
    ),
  ]);

  try {
    const indexes = await Currency.collection.indexes();
    const legacyCodeIndex = indexes.find((idx) => idx.name === "branchId_1_code_1");
    const legacySymbolIndex = indexes.find((idx) => idx.name === "branchId_1_symbol_1");
    if (legacyCodeIndex) await Currency.collection.dropIndex("branchId_1_code_1");
    if (legacySymbolIndex) await Currency.collection.dropIndex("branchId_1_symbol_1");
  } catch {
    // ignore
  }

  await Currency.collection.updateMany(
    { symbol: { $type: "string" } },
    [{ $set: { symbol: { en: "$symbol", ar: "$symbol" } } }] as any
  );

  const branches = await Branch.find().select("_id");
  await Promise.all(
    branches.map(async (branch) => {
      const count = await Currency.countDocuments({ branchId: branch._id });
      if (count === 0) {
        await Currency.create({
          branchId: branch._id,
          symbol: { en: "SYP", ar: "ل.س" },
          exchangeRate: 1,
          isPrimary: true,
          isActive: true,
        });
      }
    })
  );
};

export const ensureCategoryIndexes = async () => {
  try {
    const indexes = await Category.collection.indexes();
    const legacy = indexes.find((idx) => idx.name === "name_1");
    if (legacy) {
      await Category.collection.dropIndex("name_1");
    }
  } catch {
    // ignore
  }
};

export const ensureProductIndexes = async () => {
  try {
    const indexes = await Product.collection.indexes();
    const legacyBarcodeIndex = indexes.find((idx) => idx.name === "barcode_1");
    if (legacyBarcodeIndex) {
      await Product.collection.dropIndex("barcode_1");
    }
  } catch {
    // ignore
  }

  try {
    await Product.collection.createIndex(
      { branchId: 1, barcode: 1 },
      { unique: true, sparse: true, name: "branchId_1_barcode_1" }
    );
  } catch {
    // ignore
  }
};
