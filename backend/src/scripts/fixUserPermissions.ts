import mongoose from "mongoose";
import { env } from "../config/env";
import { PERMISSIONS } from "../constants/permissions";
import { User } from "../models/User";

const allowedPermissions = new Set<string>(PERMISSIONS);
const applyChanges = process.argv.includes("--apply");

const normalizePermission = (permission: string) => {
  if (permission === "wallet:view") return "wallet:topups:view";
  return permission;
};

const main = async () => {
  await mongoose.connect(env.mongoUri);

  const users = await User.find({}, "name email permissions").lean();
  let affectedUsers = 0;

  for (const user of users) {
    const rawPermissions = Array.isArray(user.permissions) ? user.permissions : [];
    const normalizedPermissions = rawPermissions.map(normalizePermission);
    const validPermissions = normalizedPermissions.filter((permission, index) => {
      return allowedPermissions.has(permission) && normalizedPermissions.indexOf(permission) === index;
    });
    const removedPermissions = rawPermissions.filter((permission, index) => {
      const normalized = normalizePermission(permission);
      return !allowedPermissions.has(normalized) || validPermissions.indexOf(normalized) !== index;
    });

    if (removedPermissions.length === 0 && validPermissions.length === rawPermissions.length) {
      continue;
    }

    affectedUsers += 1;
    console.log(`User: ${user.email} (${user._id})`);
    console.log(`Current: ${rawPermissions.join(", ") || "[]"}`);
    console.log(`Fixed:   ${validPermissions.join(", ") || "[]"}`);
    console.log(`Removed: ${removedPermissions.join(", ") || "[]"}`);
    console.log("");

    if (applyChanges) {
      await User.updateOne({ _id: user._id }, { $set: { permissions: validPermissions } });
    }
  }

  console.log(
    applyChanges
      ? `Applied permission cleanup for ${affectedUsers} user(s).`
      : `Dry run complete. ${affectedUsers} user(s) would be updated.`
  );

  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
