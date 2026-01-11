import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { User } from "../models/User";
import { Category } from "../models/Category";
import { Product } from "../models/Product";
import { Wallet } from "../models/Wallet";

const run = async () => {
  await mongoose.connect(env.mongoUri);
  console.log("Connected to Mongo for seeding");

  const adminEmail = "admin@shopico-sy.com";
  const adminPassword = "Pass@123";

  const existingAdmin = await User.findOne({ email: adminEmail });
  if (!existingAdmin) {
    const hashed = await bcrypt.hash(adminPassword, 10);
    const admin = await User.create({ name: "Admin", email: adminEmail, password: hashed, role: "admin" });
    await Wallet.create({ user: admin._id, balance: 0 });
    console.log(`Created admin user ${adminEmail}`);
  } else {
    console.log(`Admin ${adminEmail} already exists`);
  }

  const categories = await Category.insertMany(
    [
      { name: "Fruits", description: "Fresh fruits" },
      { name: "Vegetables", description: "Green and leafy" },
      { name: "Dairy", description: "Milk and cheese" },
    ],
    { ordered: false }
  ).catch(() => []);
  console.log("Categories seeded", categories.length || "existing");

  const fruitsCategory = await Category.findOne({ name: "Fruits" });
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
        },
        {
          name: "Apples",
          description: "Crisp apples",
          price: 7000,
          categories: [fruitsCategory._id],
          images: [],
          isAvailable: true,
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
