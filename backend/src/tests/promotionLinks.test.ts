import { describe, expect, test } from "vitest";
import { bannerSchema } from "../validators/bannerValidators";
import { announcementSchema } from "../validators/announcementValidators";

const image = { url: "https://example.com/banner.jpg", fileId: "image-id" };
for (const [name, schema] of [["banner", bannerSchema], ["announcement", announcementSchema]] as const) {
  describe(`${name} destinations`, () => {
    test.each(["/products/507f1f77bcf86cd799439011", "/categories/507f1f77bcf86cd799439011", "https://example.com/sale", ""])("accepts %s on create and edit", link => {
      expect(schema.safeParse({ image, link }).success).toBe(true);
      expect(schema.partial().safeParse({ link }).success).toBe(true);
    });
    test.each(["/products/invalid", "/categories/", "//example.com", "javascript:alert(1)", "file:///tmp/test", "/admin/users"])("rejects %s", link => {
      expect(schema.safeParse({ image, link }).success).toBe(false);
    });
    test("preserves internal destinations and clears an empty link", () => {
      const link = "/products/507f1f77bcf86cd799439011";
      expect(schema.parse({ image, link }).link).toBe(link);
      expect(schema.partial().parse({ link: "" }).link).toBeUndefined();
    });
  });
}
