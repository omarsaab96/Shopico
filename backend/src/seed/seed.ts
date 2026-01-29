import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { User } from "../models/User";
import { Category } from "../models/Category";
import { Product } from "../models/Product";
import { Wallet } from "../models/Wallet";
import { PERMISSIONS } from "../constants/permissions";
import { Branch } from "../models/Branch";

const run = async () => {
  await mongoose.connect(env.mongoUri);
  console.log("Connected to Mongo for seeding");

  const adminEmail = "admin@shopico-sy.com";
  const adminPassword = "Pass@123";

  const existingAdmin = await User.findOne({ email: adminEmail });
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
  if (!existingAdmin) {
    const hashed = await bcrypt.hash(adminPassword, 10);
    const admin = await User.create({
      name: "Admin",
      email: adminEmail,
      password: hashed,
      role: "admin",
      permissions: [...PERMISSIONS],
      branchIds: [defaultBranch._id],
    });
    await Wallet.create({ user: admin._id, balance: 0 });
    console.log(`Created admin user ${adminEmail}`);
  } else {
    const hasAllPermissions =
      Array.isArray(existingAdmin.permissions) &&
      PERMISSIONS.every((permission) => existingAdmin.permissions.includes(permission));
    if (!hasAllPermissions) {
      existingAdmin.permissions = [...PERMISSIONS];
      await existingAdmin.save();
      console.log(`Updated admin permissions for ${adminEmail}`);
    }
    console.log(`Admin ${adminEmail} already exists`);
  }

  const categories = await Category.insertMany(
    [
      { name: "Fruits", description: "Fresh fruits", branchId: defaultBranch._id },
      { name: "Vegetables", description: "Green and leafy", branchId: defaultBranch._id },
      { name: "Dairy", description: "Milk and cheese", branchId: defaultBranch._id },
    ],
    { ordered: false }
  ).catch(() => []);
  console.log("Categories seeded", categories.length || "existing");

  const fruitsCategory = await Category.findOne({ name: "Fruits", branchId: defaultBranch._id });
  if (fruitsCategory) {
    await Product.insertMany(
      [
        {
          name: "Bananas",
          description: "Sweet bananas",
          price: 5000,
          categories: [fruitsCategory._id],
          images: [],
          isAvailable: true,
          branchId: defaultBranch._id,
        },
        {
          name: "Apples",
          description: "Crisp apples",
          price: 7000,
          categories: [fruitsCategory._id],
          images: [],
          isAvailable: true,
          branchId: defaultBranch._id,
        },
      ],
      { ordered: false }
    ).catch(() => []);
  }

  console.log("Seed complete");
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
