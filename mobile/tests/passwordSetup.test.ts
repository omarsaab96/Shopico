import { describe, expect, test } from "vitest";
import { parsePasswordSetup } from "../lib/passwordSetup";

describe("password setup invitations", () => {
  test("extracts the code and email from the admin-generated link", () => {
    const link = new URL("https://admin.example.com/login");
    link.searchParams.set("email", "customer+test@example.com");
    link.searchParams.set("setupToken", "a".repeat(64));
    expect(parsePasswordSetup(link.toString())).toEqual({ setupToken: "a".repeat(64), email: "customer+test@example.com" });
  });
  test("accepts a pasted code with surrounding whitespace", () => {
    expect(parsePasswordSetup(`  ${"b".repeat(64)}  `)).toEqual({ setupToken: "b".repeat(64) });
  });
  test("does not treat a URL without a token as an invitation", () => {
    expect(parsePasswordSetup("https://admin.example.com/login").setupToken).toBe("");
  });
  test("accepts mobile invitation URLs", () => {
    expect(parsePasswordSetup("shopico://auth/login?setupToken=abcdefghijklmnop&email=test%40example.com"))
      .toEqual({ setupToken: "abcdefghijklmnop", email: "test@example.com" });
  });
  test("an empty input has no token", () => {
    expect(parsePasswordSetup(" ").setupToken).toBe("");
  });
});
