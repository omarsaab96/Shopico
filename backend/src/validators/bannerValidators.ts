import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const optionalUrl = z
  .string()
  .trim()
  .url()
  .refine(value => /^https?:\/\//i.test(value), "Use an HTTP or HTTPS link")
  .optional()
  .or(z.literal(""))
  .transform((value) => (value ? value : undefined));

export const bannerSchema = z.object({
  title: optionalText,
  description: optionalText,
  link: optionalUrl,
  image: z
    .object({
      url: z.string().url(),
      fileId: z.string().min(1),
    }),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  isEnabled: z.boolean().optional(),
});
