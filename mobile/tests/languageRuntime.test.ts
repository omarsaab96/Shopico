import { beforeEach, expect, test, vi } from "vitest";
import { LANGUAGE_STORAGE_KEY, prepareLanguageDirection, restoreLanguage } from "../lib/languageRuntime";

const values = new Map<string, string>();
const storage = {
  getItem: vi.fn(async (key: string) => values.get(key) ?? null),
  setItem: vi.fn(async (key: string, value: string) => { values.set(key, value); }),
  removeItem: vi.fn(async (key: string) => { values.delete(key); }),
};
const native = { isRTL: true, allowRTL: vi.fn(), forceRTL: vi.fn(), swapLeftAndRightInRTL: vi.fn() };
const reload = vi.fn(async () => {});
beforeEach(() => { values.clear(); vi.clearAllMocks(); native.isRTL = true; });

test("saved Arabic wins over English device language without temporarily writing LTR", async () => {
  values.set(LANGUAGE_STORAGE_KEY, "ar");
  const fallback = vi.fn(() => "en" as const);
  const lang = await restoreLanguage(storage, fallback);
  await prepareLanguageDirection(lang, "android", storage, native, reload);
  expect(fallback).not.toHaveBeenCalled();
  expect(native.forceRTL.mock.calls).toEqual([[true]]);
  expect(reload).not.toHaveBeenCalled();
});

test("saved English wins over Arabic device language", async () => {
  values.set(LANGUAGE_STORAGE_KEY, "en");
  native.isRTL = false;
  const lang = await restoreLanguage(storage, () => "ar");
  await prepareLanguageDirection(lang, "ios", storage, native, reload);
  expect(native.forceRTL.mock.calls).toEqual([[false]]);
  expect(native.allowRTL).toHaveBeenCalledWith(false);
  expect(reload).not.toHaveBeenCalled();
});

test.each([null, "invalid"])("missing or invalid preference %s uses the device language", async saved => {
  if (saved) values.set(LANGUAGE_STORAGE_KEY, saved);
  expect(await restoreLanguage(storage, () => "ar")).toBe("ar");
});

test("matching native snapshot still repairs persisted direction flags", async () => {
  await prepareLanguageDirection("ar", "android", storage, native, reload);
  expect(native.allowRTL).toHaveBeenCalledWith(true);
  expect(native.forceRTL).toHaveBeenCalledWith(true);
  expect(native.swapLeftAndRightInRTL).toHaveBeenCalledWith(true);
});

test("mismatch reloads once and blocks conflicting rendering without a reload loop", async () => {
  native.isRTL = false;
  await expect(prepareLanguageDirection("ar", "android", storage, native, reload)).rejects.toThrow("reopen");
  await expect(prepareLanguageDirection("ar", "android", storage, native, reload)).rejects.toThrow("reopen");
  expect(reload).toHaveBeenCalledTimes(1);
  native.isRTL = true;
  await expect(prepareLanguageDirection("ar", "android", storage, native, reload)).resolves.toBeUndefined();
  // After a successful restart, a future opposite language switch can reload.
  await expect(prepareLanguageDirection("en", "android", storage, native, reload)).rejects.toThrow("reopen");
  expect(reload).toHaveBeenCalledTimes(2);
});

test("web switches direction without native flags or reload", async () => {
  await prepareLanguageDirection("ar", "web", storage, native, reload);
  expect(native.forceRTL).not.toHaveBeenCalled();
  expect(reload).not.toHaveBeenCalled();
});
