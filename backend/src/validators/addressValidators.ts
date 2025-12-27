import { z } from "zod";

export const addressSchema = z.object({
  label: z.string().min(1),
  address: z.string().min(3),
  lat: z.number(),
  lng: z.number(),
  phone: z.string().optional(),
});

export const addressUpdateSchema = addressSchema.partial();
