import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");
const openingHours = z.array(z.object({ day: z.number().int().min(0).max(6), start: time, end: time }))
  .superRefine((slots, ctx) => {
    const intervals = slots.map(s => ({ start: s.day * 1440 + Number(s.start.slice(0, 2)) * 60 + Number(s.start.slice(3)), end: s.day * 1440 + Number(s.end.slice(0, 2)) * 60 + Number(s.end.slice(3)) + (s.end < s.start ? 1440 : 0) }));
    if (slots.some(s => s.start === s.end)) ctx.addIssue({ code: "custom", message: "Opening and closing times must differ" });
    if (intervals.some((a, i) => intervals.some((b, j) => i !== j && [-10080, 0, 10080].some(shift => a.start < b.end + shift && b.start + shift < a.end))))
      ctx.addIssue({ code: "custom", message: "Opening slots must not overlap" });
  });

export const branchSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  phone: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
  openHours: z.string().optional(),
  openingHours: openingHours.nullable().optional(),
  timeZone: z.string().refine(value => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }, "Invalid timezone").optional(),
  deliveryRadiusKm: z.number().optional(),
  isActive: z.boolean().optional(),
});
