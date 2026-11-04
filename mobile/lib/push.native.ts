import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import api, { isSessionEnding } from "./api";

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });

let operations: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const result = operations.then(task, task);
  operations = result.catch(() => {});
  return result;
}
export function registerPush(language: string, requestPermission = false): Promise<string> {
  return serial(() => register(language, requestPermission));
}
async function register(language: string, requestPermission: boolean): Promise<string> {
  if (isSessionEnding()) return "signed-out";
  const session = await SecureStore.getItemAsync("accessToken");
  if (!session) return "signed-out";
  if (!Device.isDevice) return "device-required";
  if (Constants.appOwnership === "expo") return "build-required";
  if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("orders", { name: "Shopico updates", importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 250, 250, 250], sound: "default" });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain && requestPermission) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return "permission-required";
  const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
  if (!projectId) throw new Error("Missing Expo project ID");
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  if (isSessionEnding() || session !== await SecureStore.getItemAsync("accessToken")) return "signed-out";
  const refreshToken = await SecureStore.getItemAsync("refreshToken");
  await api.post("/notifications/devices", { token, language, refreshToken: refreshToken || undefined });
  await SecureStore.setItemAsync("notificationPushToken", token);
  return "registered";
}
export function unregisterPush(): Promise<void> { return serial(unregister); }
async function unregister(): Promise<void> {
  const token = await SecureStore.getItemAsync("notificationPushToken");
  try { await api.post("/auth/logout", { deviceToken: token || undefined }, { timeout: 5000 }); }
  catch (error: any) { if (![401, 404].includes(error?.response?.status)) throw error; }
  if (token) {
    await SecureStore.deleteItemAsync("notificationPushToken");
  }
  await Notifications.setBadgeCountAsync(0);
}
export async function updateBadge(count: number): Promise<void> { await Notifications.setBadgeCountAsync(count); }
export function listenPush(received: (data: any) => void, opened: (data: any) => void, rotated: () => void): () => void {
  if (Constants.appOwnership === "expo") return () => {};
  const receipt = Notifications.addNotificationReceivedListener(value => received(value.request.content.data));
  const response = Notifications.addNotificationResponseReceivedListener(value => { opened(value.notification.request.content.data); void Notifications.clearLastNotificationResponseAsync(); });
  const token = Notifications.addPushTokenListener(rotated);
  let active = true;
  void Notifications.getLastNotificationResponseAsync().then(value => { if (active && value) { opened(value.notification.request.content.data); void Notifications.clearLastNotificationResponseAsync(); } }).catch(() => {});
  return () => { active = false; receipt.remove(); response.remove(); token.remove(); };
}
