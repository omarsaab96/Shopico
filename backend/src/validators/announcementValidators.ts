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
  .optional()
  .or(z.literal(""))
  .transform((value) => (value ? value : undefined));

export const announcementSchema = z.object({
  title: optionalText,
  description: optionalText,
  link: optionalUrl,
  image: z
    .object({
      url: z.string().url(),
      fileId: z.string().min(1),
    })
    .optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  isEnabled: z.boolean().optional(),
});
