import { z } from "zod";

const productImageSchema = z.object({
  url: z.string().url(),
  fileId: z.string().min(1),
});

const productVariantSchema = z.object({
  _id: z.string().min(1).optional(),
  sku: z.string().optional(),
  barcode: z.string().min(1).optional(),
  attributes: z.record(z.string(), z.string()).optional().default({}),
  price: z.number().nonnegative().optional(),
  promoPrice: z.number().nonnegative().optional(),
  isPromoted: z.boolean().optional(),
  images: z.array(productImageSchema).optional().default([]),
  isAvailable: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

export const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  barcode: z.string().min(1).optional(),
  price: z.number().nonnegative(),
  promoPrice: z.number().nonnegative().optional(),
  isPromoted: z.boolean().optional(),
  categories: z.array(z.string().min(1)).optional().default([]),
  images: z.array(productImageSchema).optional().default([]),
  variants: z.array(productVariantSchema).optional().default([]),
  isAvailable: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

export const productUpdateSchema = productSchema.partial();

export const bulkPriceSchema = z.object({
  mode: z.enum(["INCREASE", "DISCOUNT"]),
  amountType: z.enum(["FIXED", "PERCENT"]),
  amount: z.number().positive(),
});
