import axios from "axios";
import Constants from "expo-constants";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";

// Android/default implementation: no location tasks or foreground services.
// iOS retains its existing implementation in driverTracking.ios.ts.
const apiBase = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_BASE ||
  (Constants as any).manifest?.extra?.EXPO_PUBLIC_API_BASE || "http://localhost:4000/api";
let activeOrderId: string | null = null;
let watcher: Location.LocationSubscription | null = null;
let appStateListener: ReturnType<typeof AppState.addEventListener> | null = null;
let generation = 0;

export const pushDriverLocationOnce = async (orderId: string, coords: { latitude: number; longitude: number }) => {
  if (AppState.currentState !== "active") return;
  const requestGeneration = generation;
  const token = await SecureStore.getItemAsync("accessToken");
  if (!token || requestGeneration !== generation || AppState.currentState !== "active") return;
  try {
    await axios.put(`${apiBase}/orders/${orderId}/driver-location`, {
      lat: coords.latitude, lng: coords.longitude,
    }, { headers: { Authorization: `Bearer ${token}` } });
  } catch (error: any) {
    if ([400, 401, 403, 404].includes(error.response?.status)) await stopDriverTracking(orderId);
    throw error;
  }
};

const pause = () => {
  generation++;
  watcher?.remove();
  watcher = null;
};

const watch = async () => {
  pause();
  const currentGeneration = generation;
  const orderId = activeOrderId;
  if (!orderId || AppState.currentState !== "active") return;
  const permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== "granted" || currentGeneration !== generation || AppState.currentState !== "active") return;
  const subscription = await Location.watchPositionAsync({
    accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 10000,
  }, position => {
    if (currentGeneration === generation && activeOrderId === orderId && AppState.currentState === "active") {
      void pushDriverLocationOnce(orderId, position.coords).catch(() => {});
    }
  });
  if (currentGeneration !== generation || AppState.currentState !== "active") subscription.remove();
  else watcher = subscription;
};

export const startDriverTracking = async (orderId: string) => {
  if (AppState.currentState !== "active") throw new Error("Open Shopico to start location sharing");
  const permissionGeneration = generation;
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted") throw new Error("Location permission denied");
  if (permissionGeneration !== generation || AppState.currentState !== "active") return;
  activeOrderId = orderId;
  appStateListener ??= AppState.addEventListener("change", state => {
    if (state === "active") void watch().catch(() => {});
    else pause();
  });
  try { await watch(); }
  catch (error) { await stopDriverTracking(orderId); throw error; }
};

export const stopDriverTracking = async (orderId?: string) => {
  if (orderId && activeOrderId !== orderId) return;
  activeOrderId = null;
  pause();
  appStateListener?.remove();
  appStateListener = null;
};
