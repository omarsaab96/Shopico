import { z } from "zod";
import { normalizePhone } from "../utils/phone";

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().trim().min(1).max(64),
  phoneCountry: z.string().length(2),
  confirmPhone: z.string().trim().min(1).max(64),
  password: z.string().min(6),
}).superRefine((data, ctx) => {
  const phone = normalizePhone(data.phone, data.phoneCountry);
  if (!phone) ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a valid phone number for the selected country" });
  const confirmation = normalizePhone(data.confirmPhone, data.phoneCountry);
  if (!phone || !confirmation || phone.phone !== confirmation.phone) {
    ctx.addIssue({ code: "custom", path: ["confirmPhone"], message: "Phone numbers must match" });
  }
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
  phone: z.string().trim().min(1).max(64).optional(),
  phoneCountry: z.string().length(2).optional(),
}).superRefine((data, ctx) => {
  if (data.phone !== undefined || data.phoneCountry !== undefined) {
    if (!data.phone || !data.phoneCountry || !normalizePhone(data.phone, data.phoneCountry)) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a valid phone number and country" });
    }
  }
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6),
});

export const verifyEmailOtpSchema = z.object({
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
});

export const deleteProfileSchema = z.object({
  password: z.string().min(6),
});
