import { z } from "zod";

export const topUpRequestSchema = z.object({
  amount: z.number().positive(),
  currencyId: z.string().min(1).optional(),
  method: z.enum(["CASH_STORE", "SHAM_CASH", "BANK_TRANSFER"]),
  note: z.string().optional(),
});

export const updateTopUpSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  adminNote: z.string().optional(),
});

export const adminTopUpSchema = z.object({
  userId: z.string().min(1),
  amount: z.number().positive(),
  currencyId: z.string().min(1).optional(),
  note: z.string().optional(),
});

export const adminTopUpRequestSchema = z.object({
  userId: z.string().optional(),
  email: z.string().email().optional(),
  amount: z.number().positive(),
  currencyId: z.string().min(1).optional(),
  method: z.enum(["CASH_STORE", "SHAM_CASH", "BANK_TRANSFER"]),
  note: z.string().optional(),
}).refine((data) => Boolean(data.userId || data.email), {
  message: "User is required",
});
