import { describe, expect, test } from "vitest";
import { formatProfilePhone, normalizePhone, profilePhone } from "../lib/phone";

describe("phone entry and saved profiles", () => {
  test("local and international input match after normalization", () => {
    expect(normalizePhone("0944123456", "SY")).toEqual(normalizePhone("+963 944 123 456", "SY"));
    expect(normalizePhone("٠٩٤٤١٢٣٤٥٦", "SY")).toEqual(normalizePhone("0944123456", "SY"));
  });
  test("rejects wrong country, invalid digits, extensions and incomplete input", () => {
    for (const phone of ["", "123", "+12133734253", "call 0944123456", "0944123456 ext 12"]) {
      expect(normalizePhone(phone, "SY")).toBeNull();
    }
    expect(normalizePhone("0944123456", "XX")).toBeNull();
  });
  test("prepares new and legacy profiles for editing without losing the number", () => {
    expect(profilePhone(undefined)).toEqual({ country: "SY", phone: "" });
    expect(profilePhone({ phone: "+12133734253" })).toEqual({ country: "US", phone: "2133734253" });
    expect(profilePhone({ phone: "944123456", phoneCountry: "SY", phoneCountryCode: "+963" })).toEqual({ country: "SY", phone: "944123456" });
    expect(formatProfilePhone({ phone: "944123456", phoneCountryCode: "+963" })).toBe("+963 944123456");
  });
});
