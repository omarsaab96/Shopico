import { z } from "zod";
import { PERMISSIONS, Permission } from "../constants/permissions";

const permissionEnum = z.enum(PERMISSIONS as [Permission, ...Permission[]]);
const permissionsSchema = z.preprocess(
  (value) => {
    if (!Array.isArray(value)) return value;
    return value.map((permission) =>
      permission === "wallet:view" ? "wallet:topups:view" : permission
    );
  },
  z.array(permissionEnum)
);

export const updateUserPermissionsSchema = z.object({
  permissions: permissionsSchema,
});

export const updateUserBranchesSchema = z.object({
  branchIds: z.array(z.string().min(1)),
});

export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6).optional(),
  role: z.enum(["customer", "manager", "staff", "driver"]),
  phone: z.string().optional(),
  permissions: permissionsSchema.optional(),
  branchIds: z.array(z.string().min(1)).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["customer", "manager", "staff", "driver"]).optional(),
  phone: z.string().optional(),
});
