import { z } from "zod";

export const branchSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  phone: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
  openHours: z.string().optional(),
  deliveryRadiusKm: z.number().optional(),
  isActive: z.boolean().optional(),
});
