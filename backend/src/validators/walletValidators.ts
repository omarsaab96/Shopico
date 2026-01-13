import { z } from "zod";

export const topUpRequestSchema = z.object({
  amount: z.number().positive(),
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
  note: z.string().optional(),
});
