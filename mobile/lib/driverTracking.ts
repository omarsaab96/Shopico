import axios from "axios";
import Constants from "expo-constants";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";

const DRIVER_LOCATION_TASK = "shopico-driver-location-task";
const ACTIVE_DRIVER_ORDER_KEY = "activeDriverOrderId";

const apiBase =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_API_BASE ||
  (Constants as any).manifest?.extra?.EXPO_PUBLIC_API_BASE ||
  "http://localhost:4000/api";

const pushDriverLocation = async (orderId: string, coords: { latitude: number; longitude: number }) => {
  const token = await SecureStore.getItemAsync("accessToken");
  if (!token) return;

  await axios.put(
    `${apiBase}/orders/${orderId}/driver-location`,
    {
      lat: coords.latitude,
      lng: coords.longitude,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
};

TaskManager.defineTask(DRIVER_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;

  const orderId = await SecureStore.getItemAsync(ACTIVE_DRIVER_ORDER_KEY);
  if (!orderId) return;

  const locations = (data as { locations?: Location.LocationObject[] })?.locations || [];
  const latest = locations[locations.length - 1];
  if (!latest) return;

  await pushDriverLocation(orderId, latest.coords);
});

export const startDriverBackgroundTracking = async (orderId: string) => {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== "granted") {
    throw new Error("Foreground location permission denied");
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== "granted") {
    throw new Error("Background location permission denied");
  }

  await SecureStore.setItemAsync(ACTIVE_DRIVER_ORDER_KEY, orderId);

  const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
  await pushDriverLocation(orderId, current.coords);

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  if (alreadyStarted) {
    await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  }

  await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, {
    accuracy: Location.Accuracy.Highest,
    distanceInterval: 10,
    timeInterval: 10000,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: "Shopico delivery tracking",
      notificationBody: "Sharing your location while this delivery is active.",
      notificationColor: "#f97316",
    },
  });
};

export const stopDriverBackgroundTracking = async () => {
  await SecureStore.deleteItemAsync(ACTIVE_DRIVER_ORDER_KEY);
  const started = await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  if (started) {
    await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  }
};

export const pushDriverLocationOnce = pushDriverLocation;
