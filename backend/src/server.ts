import { activateNotifications, startNotificationWorker } from "./notifications/worker";
import mongoose from "mongoose";
import app from "./app";
import { startRefundRecovery } from "./services/refundSettlementService";
import { Order } from "./models/Order";
import { SINGLE_DRIVER_DELIVERY_INDEX } from "./utils/driverDelivery";
import { env } from "./config/env";
import { ensureCategoryIndexes, ensureDefaultBranchSetup, ensureProductIndexes } from "./utils/branchMigration";

const start = async () => {
  try {
    await mongoose.connect(env.mongoUri);
    console.log("Mongo connected");
    await ensureDefaultBranchSetup();
    await ensureCategoryIndexes();
    await ensureProductIndexes();
    // Do not accept delivery starts before the concurrency constraint is installed.
    // Existing duplicate shipping orders must be reconciled by staff before deployment.
    await Order.collection.createIndex({ driverId: 1 }, {
      name: SINGLE_DRIVER_DELIVERY_INDEX, unique: true,
      partialFilterExpression: { status: "SHIPPING", driverId: { $type: "objectId" } },
    });
    await activateNotifications();
    startRefundRecovery();
    startNotificationWorker();
    app.listen(env.port, () => {
      console.log(`Server running on port ${env.port}`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
};

start();
