import { Branch } from "../models/Branch";
import { Category } from "../models/Category";
import { Product } from "../models/Product";
import { Order } from "../models/Order";
import { Announcement } from "../models/Announcement";
import { Coupon } from "../models/Coupon";
import { Settings } from "../models/Settings";
import { TopUpRequest } from "../models/TopUpRequest";
import { User } from "../models/User";

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
  ]);
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
