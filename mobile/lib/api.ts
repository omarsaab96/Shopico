import axios from "axios";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

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
  return config;
});

export const storeTokens = async (access: string, refresh: string) => {
  await SecureStore.setItemAsync("accessToken", access);
  await SecureStore.setItemAsync("refreshToken", refresh);
};

export const clearTokens = async () => {
  await SecureStore.deleteItemAsync("accessToken");
  await SecureStore.deleteItemAsync("refreshToken");
};

export default api;
