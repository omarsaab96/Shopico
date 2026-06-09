import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const passwordStatusSchema = z.object({
  email: z.string().email(),
  setupToken: z.string().min(16).optional(),
});

export const setPasswordSchema = z.object({
  email: z.string().email(),
  setupToken: z.string().min(16),
  password: z.string().min(6),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6),
});

export const deleteProfileSchema = z.object({
  password: z.string().min(6),
});
