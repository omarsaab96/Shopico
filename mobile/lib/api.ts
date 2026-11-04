import axios from "axios";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { AppState, DeviceEventEmitter } from "react-native";

let branchIdCache: string | null = null;
let branchLockCache: boolean | null = null;
let sessionEpoch = 0;
let refreshPromise: Promise<string> | null = null;
let refreshEpoch = -1;
let tokenWrites: Promise<unknown> = Promise.resolve();
let endingSession = false;

export const isSessionEnding = () => endingSession;
export const beginSessionLogout = () => { endingSession = true; sessionEpoch += 1; };

const writeTokens = (operation: () => Promise<void>) => {
  const next = tokenWrites.then(operation, operation);
  tokenWrites = next.catch(() => {});
  return next;
};

export class SessionChangedError extends Error {}

// One refresh per session, even when several requests expire together. A late
// response must never restore a session after logout or overwrite a new login.
export function renewMobileSession(): Promise<string> {
  if (endingSession) return Promise.reject(new SessionChangedError("Session ending"));
  const epoch = sessionEpoch;
  if (refreshPromise && refreshEpoch === epoch) return refreshPromise;
  const operation = (async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync("refreshToken");
      if (epoch !== sessionEpoch) throw new SessionChangedError("Session changed");
      if (!refreshToken) throw Object.assign(new Error("No refresh token"), { sessionExpired: true });
      const deviceToken = await SecureStore.getItemAsync("notificationPushToken");
      const response = await axios.post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken, deviceToken }, { timeout: 15000 });
      if (epoch !== sessionEpoch) throw new SessionChangedError("Session changed");
      const { accessToken, refreshToken: nextRefresh } = response.data.data;
      await writeTokens(async () => {
        if (epoch !== sessionEpoch) throw new SessionChangedError("Session changed");
        await SecureStore.setItemAsync("accessToken", accessToken);
        await SecureStore.setItemAsync("refreshToken", nextRefresh);
      });
      if (epoch !== sessionEpoch) throw new SessionChangedError("Session changed");
      DeviceEventEmitter.emit("shopico:session-renewed");
      return accessToken as string;
    } catch (error: any) {
      if (epoch === sessionEpoch && (error.sessionExpired || [401, 403].includes(error.response?.status))) {
        await clearTokens();
        DeviceEventEmitter.emit("shopico:session-expired");
      }
      // Offline and server failures retain credentials for the next retry.
      throw error;
    }
  })();
  refreshEpoch = epoch;
  refreshPromise = operation;
  void operation.finally(() => { if (refreshPromise === operation) refreshPromise = null; }).catch(() => {});
  return operation;
}

const api = axios.create({
  baseURL: Constants.expoConfig?.extra?.EXPO_PUBLIC_API_BASE || "http://localhost:4000/api",
});

api.interceptors.request.use(async (config) => {
  // console.log("REQUEST BASE URL =", config.baseURL);

  const epoch = sessionEpoch;
  const token = await SecureStore.getItemAsync("accessToken");
  if (epoch !== sessionEpoch) throw new SessionChangedError("Session changed");
  (config as any)._sessionEpoch = epoch;
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (!branchIdCache) {
    branchIdCache = await SecureStore.getItemAsync("branchId");
  }
  if (branchIdCache && !config.headers?.["x-branch-id"]) {
    config.headers = config.headers || {};
    config.headers["x-branch-id"] = branchIdCache;
  }
  if (epoch !== sessionEpoch) throw new SessionChangedError("Session changed");
  return config;
});

api.interceptors.response.use(
  response => response,
  async error => {
    const url = String(error.config?.url || "");
    const original = error.config;
    const isAuth = ["/auth/login", "/auth/register", "/auth/set-password", "/auth/password-status", "/auth/logout", "/auth/refresh"].some(path => url.includes(path));
    if (error.response?.status === 401 && original && !isAuth && original._sessionEpoch !== sessionEpoch) throw new SessionChangedError("Session changed");
    if (error.response?.status === 401 && original && !original._retry && !isAuth) {
      if (AppState.currentState !== "active") return Promise.reject(error);
      original._retry = true;
      const failedToken = String(original.headers?.Authorization || "");
      const currentToken = await SecureStore.getItemAsync("accessToken");
      // Another request may have already completed renewal before this 401 arrived.
      const accessToken = currentToken && failedToken !== `Bearer ${currentToken}` ? currentToken : await renewMobileSession();
      original.headers.Authorization = `Bearer ${accessToken}`;
      return api(original);
    }
    if (error.response?.status === 401 && original?._retry && !isAuth) {
      await clearTokens(); DeviceEventEmitter.emit("shopico:session-expired");
    }
    return Promise.reject(error);
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
  endingSession = false;
  const epoch = ++sessionEpoch;
  await writeTokens(async () => {
    if (epoch !== sessionEpoch) return;
    await SecureStore.setItemAsync("accessToken", access);
    await SecureStore.setItemAsync("refreshToken", refresh);
  });
};

export const clearTokens = async () => {
  beginSessionLogout();
  await writeTokens(async () => {
    await SecureStore.deleteItemAsync("accessToken");
    await SecureStore.deleteItemAsync("refreshToken");
  });
};

export default api;
