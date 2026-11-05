import { z } from "zod";

// Internal destinations use the same routes as the customer app.
export const promotionLinkSchema = z.string().trim().refine(
  value => !value || /^\/(products|categories)\/[a-f0-9]{24}$/i.test(value) ||
    (/^https?:\/\//i.test(value) && z.string().url().safeParse(value).success),
  "Choose a product or category, or use an HTTP or HTTPS link"
).optional().transform(value => value || undefined);
