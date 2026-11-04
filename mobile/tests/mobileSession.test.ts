import { beforeEach, expect, test, vi } from "vitest";
import axios, { AxiosError } from "axios";
import { AppState } from "react-native";

const mocks = vi.hoisted(() => ({ values: new Map<string, string>(), emit: vi.fn() }));
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (key: string) => mocks.values.get(key) || null),
  setItemAsync: vi.fn(async (key: string, value: string) => { mocks.values.set(key, value); }),
  deleteItemAsync: vi.fn(async (key: string) => { mocks.values.delete(key); }),
}));
vi.mock("expo-constants", () => ({ default: { expoConfig: { extra: { EXPO_PUBLIC_API_BASE: "http://session.test/api" } } } }));
vi.mock("react-native", () => ({ DeviceEventEmitter: { emit: mocks.emit }, AppState: { currentState: "active" } }));
import api, { beginSessionLogout, clearTokens, renewMobileSession, SessionChangedError, storeTokens } from "../lib/api";

const response = (accessToken = "renewed-access", refreshToken = "renewed-refresh") => ({ data: { data: { accessToken, refreshToken } } });
beforeEach(async () => {
  vi.restoreAllMocks(); mocks.values.clear(); mocks.emit.mockClear();
  AppState.currentState = "active";
  await clearTokens();
  await storeTokens("old-access", "old-refresh");
});

test("opening/resuming renews even a valid access token and rotates both stored credentials", async () => {
  const post = vi.spyOn(axios, "post").mockResolvedValue(response());
  await renewMobileSession();
  expect(post).toHaveBeenCalledWith("http://session.test/api/auth/refresh", { refreshToken: "old-refresh", deviceToken: null }, { timeout: 15000 });
  expect(mocks.values.get("accessToken")).toBe("renewed-access");
  expect(mocks.values.get("refreshToken")).toBe("renewed-refresh");
  expect(mocks.emit).toHaveBeenCalledWith("shopico:session-renewed");
  post.mockResolvedValue(response("next-access", "next-refresh"));
  await renewMobileSession();
  expect(post.mock.calls[1][1]).toMatchObject({ refreshToken: "renewed-refresh" });
});

test("concurrent expired requests share one silent refresh and retry successfully", async () => {
  const post = vi.spyOn(axios, "post").mockResolvedValue(response());
  api.defaults.adapter = async config => {
    if (config.headers.Authorization !== "Bearer renewed-access") throw new AxiosError("Expired", "ERR_BAD_REQUEST", config, undefined, { data: {}, status: 401, statusText: "Unauthorized", headers: {}, config });
    return { data: { ok: true }, status: 200, statusText: "OK", headers: {}, config };
  };
  const results = await Promise.all([api.get("/orders"), api.get("/wallet")]);
  expect(post).toHaveBeenCalledTimes(1);
  expect(results.map(value => value.status)).toEqual([200, 200]);
  expect(mocks.emit).not.toHaveBeenCalledWith("shopico:session-expired");
});

test("a refresh-token rejection requires login and clears stored credentials", async () => {
  vi.spyOn(axios, "post").mockRejectedValue({ response: { status: 401 } });
  await expect(renewMobileSession()).rejects.toMatchObject({ response: { status: 401 } });
  expect(mocks.values.has("accessToken")).toBe(false); expect(mocks.values.has("refreshToken")).toBe(false);
  expect(mocks.emit).toHaveBeenCalledWith("shopico:session-expired");
});

test("offline and server errors preserve credentials for a later silent retry", async () => {
  const post = vi.spyOn(axios, "post").mockRejectedValue(new Error("offline"));
  await expect(renewMobileSession()).rejects.toThrow("offline");
  expect(mocks.values.get("refreshToken")).toBe("old-refresh");
  expect(mocks.emit).not.toHaveBeenCalledWith("shopico:session-expired");
  post.mockResolvedValue(response()); await renewMobileSession();
  expect(mocks.values.get("accessToken")).toBe("renewed-access");
});

test("a refresh response arriving after logout cannot restore the session", async () => {
  let resolve!: (value: any) => void;
  const post = vi.spyOn(axios, "post").mockImplementation(() => new Promise(done => { resolve = done; }));
  const pending = renewMobileSession();
  await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  await clearTokens(); resolve(response());
  await expect(pending).rejects.toBeInstanceOf(SessionChangedError);
  expect(mocks.values.has("accessToken")).toBe(false);
});

test("a late refresh cannot overwrite a different account's new login", async () => {
  let resolve!: (value: any) => void;
  const post = vi.spyOn(axios, "post").mockImplementation(() => new Promise(done => { resolve = done; }));
  const pending = renewMobileSession();
  await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  await storeTokens("other-access", "other-refresh"); resolve(response());
  await expect(pending).rejects.toBeInstanceOf(SessionChangedError);
  expect(mocks.values.get("accessToken")).toBe("other-access");
  expect(mocks.values.get("refreshToken")).toBe("other-refresh");
});

test("starting logout immediately blocks renewal while device cleanup is still in progress", async () => {
  let resolve!: (value: any) => void;
  const post = vi.spyOn(axios, "post").mockImplementation(() => new Promise(done => { resolve = done; }));
  const pending = renewMobileSession();
  await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  beginSessionLogout();
  await expect(renewMobileSession()).rejects.toBeInstanceOf(SessionChangedError);
  resolve(response());
  await expect(pending).rejects.toBeInstanceOf(SessionChangedError);
  expect(mocks.values.get("accessToken")).toBe("old-access");
});

test("renewal includes only this device's token so push eligibility follows its activity", async () => {
  mocks.values.set("notificationPushToken", "ExpoPushToken[this-device]");
  const post = vi.spyOn(axios, "post").mockResolvedValue(response());
  await renewMobileSession();
  expect(post.mock.calls[0][1]).toMatchObject({ deviceToken: "ExpoPushToken[this-device]" });
});

test("background requests do not extend the inactivity window", async () => {
  const post = vi.spyOn(axios, "post").mockResolvedValue(response());
  AppState.currentState = "background";
  api.defaults.adapter = async config => {
    throw new AxiosError("Expired", "ERR_BAD_REQUEST", config, undefined, { data: {}, status: 401, statusText: "Unauthorized", headers: {}, config });
  };
  await expect(api.get("/orders")).rejects.toMatchObject({ response: { status: 401 } });
  expect(post).not.toHaveBeenCalled();
  expect(mocks.values.get("refreshToken")).toBe("old-refresh");
  expect(mocks.emit).not.toHaveBeenCalledWith("shopico:session-expired");
});
