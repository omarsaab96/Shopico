import mongoose from "mongoose";
import app from "./app";
import { env } from "./config/env";
import { ensureDefaultBranchSetup } from "./utils/branchMigration";

const start = async () => {
  try {
    await mongoose.connect(env.mongoUri);
    console.log("Mongo connected");
    await ensureDefaultBranchSetup();
    app.listen(env.port, () => {
      console.log(`Server running on port ${env.port}`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
};

start();
