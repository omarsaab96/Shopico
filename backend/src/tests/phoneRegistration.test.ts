import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { existsSync } from "fs";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { normalizePhone } from "../utils/phone";
import { registerSchema, updateProfileSchema } from "../validators/authValidators";
import { User } from "../models/User";
import { register, updateMe } from "../controllers/authController";

const registration = { name: "Buyer", email: "phone@test.com", password: "test-password", phoneCountry: "SY", phone: "0944123456", confirmPhone: "+963944123456" };

describe("phone validation", () => {
  test("normalizes country code and national number separately", () => {
    expect(normalizePhone("0944123456", "SY")).toEqual({ phone: "944123456", phoneCountryCode: "+963", phoneCountry: "SY" });
    expect(normalizePhone("(213) 373-4253", "US")).toEqual({ phone: "2133734253", phoneCountryCode: "+1", phoneCountry: "US" });
  });
  test("requires a valid phone, country and matching confirmation", () => {
    expect(registerSchema.safeParse(registration).success).toBe(true);
    for (const changes of [{ phone: undefined }, { phoneCountry: undefined }, { phoneCountry: "XX" }, { phone: "123" }, { confirmPhone: "0944123457" }, { confirmPhone: undefined }, { phone: "+12133734253" }, { phone: "call 0944123456" }, { phone: "0944123456 ext 12" }]) {
      expect(registerSchema.safeParse({ ...registration, ...changes }).success).toBe(false);
    }
  });
  test("profile phone changes require both a valid country and number", () => {
    expect(updateProfileSchema.safeParse({ name: "Buyer" }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ phoneCountry: "SY", phone: "0944123456" }).success).toBe(true);
    for (const payload of [{ phone: "0944123456" }, { phoneCountry: "SY" }, { phoneCountry: "SY", phone: "123" }]) {
      expect(updateProfileSchema.safeParse(payload).success).toBe(false);
    }
    expect(updateProfileSchema.parse({ phoneVerified: true })).toEqual({});
  });
});

describe("stored phone profile", () => {
  let mongo: MongoMemoryServer;
  beforeAll(async () => {
    const installed = `${process.env.ProgramFiles || "C:/Program Files"}/MongoDB/Server/8.0/bin/mongod.exe`;
    const systemBinary = process.env.MONGOMS_SYSTEM_BINARY || (process.platform === "win32" && existsSync(installed) ? installed : undefined);
    mongo = await MongoMemoryServer.create({ binary: { systemBinary, version: "8.0.17" } });
    await mongoose.connect(mongo.getUri());
    await User.init();
  }, 120000);
  afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });
  beforeEach(async () => { await Promise.all(Object.values(mongoose.models).map(model => model.deleteMany({}))); });

  async function invoke(handler: typeof register, body: unknown, user?: unknown) {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), cookie: vi.fn().mockReturnThis() };
    await handler({ body, user } as any, res as any, error => { throw error; });
    return res;
  }

  test("registration stores split fields as unverified and ignores a forged verification flag", async () => {
    const res = await invoke(register, { ...registration, phoneVerified: true });
    expect(res.status).toHaveBeenCalledWith(201);
    const user = await User.findOne({ email: registration.email }).orFail();
    expect(user).toMatchObject({ phone: "944123456", phoneCountryCode: "+963", phoneCountry: "SY", phoneVerified: false });
  });
  test("mismatched confirmation creates no user", async () => {
    await expect(invoke(register, { ...registration, confirmPhone: "0944123457" })).rejects.toThrow();
    expect(await User.countDocuments()).toBe(0);
  });
  test("changing a phone resets verification; equivalent formatting preserves it", async () => {
    const user = await User.create({ name: "Buyer", email: registration.email, phone: "944123456", phoneCountryCode: "+963", phoneCountry: "SY", phoneVerified: true });
    await invoke(updateMe, { phone: "0944123456", phoneCountry: "SY" }, user);
    expect((await User.findById(user._id).orFail()).phoneVerified).toBe(true);
    await invoke(updateMe, { phone: "(213) 373-4253", phoneCountry: "US", phoneVerified: true }, user);
    expect(await User.findById(user._id)).toMatchObject({ phone: "2133734253", phoneCountryCode: "+1", phoneCountry: "US", phoneVerified: false });
  });
  test("legacy users can update other fields without adding a phone", async () => {
    const user = await User.create({ name: "Buyer", email: registration.email });
    await invoke(updateMe, { name: "New name" }, user);
    expect(await User.findById(user._id)).toMatchObject({ name: "New name", phoneVerified: false });
  });
});
