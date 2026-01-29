import { z } from "zod";
import { PERMISSIONS, Permission } from "../constants/permissions";

const permissionEnum = z.enum(PERMISSIONS as [Permission, ...Permission[]]);

export const updateUserPermissionsSchema = z.object({
  permissions: z.array(permissionEnum),
});

export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["customer", "manager", "staff"]),
  phone: z.string().optional(),
  permissions: z.array(permissionEnum).optional(),
});
