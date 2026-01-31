import axios from "axios";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

let branchIdCache: string | null = null;
let refreshPromise: Promise<string> | null = null;
let branchLockCache: boolean | null = null;

const api = axios.create({
  baseURL: Constants.expoConfig.extra.EXPO_PUBLIC_API_BASE || "http://localhost:4000/api",
});

api.interceptors.request.use(async (config) => {
  // console.log("REQUEST BASE URL =", config.baseURL);

  const token = await SecureStore.getItemAsync("accessToken");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (!branchIdCache) {
    branchIdCache = await SecureStore.getItemAsync("branchId");
  }
  if (branchIdCache) {
    config.headers = config.headers || {};
    config.headers["x-branch-id"] = branchIdCache;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const url = original?.url || "";
    if (status !== 401 || original?._retry || url.includes("/auth/login") || url.includes("/auth/refresh")) {
      return Promise.reject(error);
    }
    original._retry = true;
    if (!refreshPromise) {
      refreshPromise = (async () => {
        const refreshToken = await SecureStore.getItemAsync("refreshToken");
        if (!refreshToken) throw new Error("No refresh token");
        const baseURL = api.defaults.baseURL || "";
        const res = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: nextRefresh } = res.data.data;
        await storeTokens(accessToken, nextRefresh);
        return accessToken as string;
      })();
    }
    try {
      const accessToken = await refreshPromise;
      refreshPromise = null;
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${accessToken}`;
      return api(original);
    } catch (refreshError) {
      refreshPromise = null;
      await clearTokens();
      return Promise.reject(refreshError);
    }
  }
);

export const setBranchId = async (branchId: string | null) => {
  branchIdCache = branchId;
  if (branchId) {
    await SecureStore.setItemAsync("branchId", branchId);
  } else {
    await SecureStore.deleteItemAsync("branchId");
  }
};

export const getBranchId = async () => {
  if (!branchIdCache) {
    branchIdCache = await SecureStore.getItemAsync("branchId");
  }
  return branchIdCache;
};

export const setBranchLock = async (locked: boolean) => {
  branchLockCache = locked;
  if (locked) {
    await SecureStore.setItemAsync("branchLocked", "true");
  } else {
    await SecureStore.deleteItemAsync("branchLocked");
  }
};

export const getBranchLock = async () => {
  if (branchLockCache === null) {
    const value = await SecureStore.getItemAsync("branchLocked");
    branchLockCache = value === "true";
  }
  return branchLockCache;
};

export const storeTokens = async (access: string, refresh: string) => {
  await SecureStore.setItemAsync("accessToken", access);
  await SecureStore.setItemAsync("refreshToken", refresh);
};

export const clearTokens = async () => {
  await SecureStore.deleteItemAsync("accessToken");
  await SecureStore.deleteItemAsync("refreshToken");
};

export default api;
