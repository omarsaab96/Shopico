import { requireOptionalNativeModule } from "expo";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import api, { isSessionEnding } from "./api";

type NotificationsApi = typeof import("expo-notifications");
let notificationApi: Promise<NotificationsApi | null> | undefined;
function getNotifications(): Promise<NotificationsApi | null> {
  if (Constants.appOwnership === "expo" || !requireOptionalNativeModule("ExpoPushTokenManager")) return Promise.resolve(null);
  return notificationApi ??= import("expo-notifications").then(api => {
    api.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
    return api;
  }).catch(error => {
    if (error instanceof Error && /Cannot find native module/.test(error.message)) return null;
    throw error;
  });
}

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
  const Notifications = await getNotifications();
  if (!Notifications || !requireOptionalNativeModule("ExpoDevice")) return "build-required";
  const Device = await import("expo-device");
  if (!Device.isDevice) return "device-required";
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
  await updateBadge(0);
}
export async function updateBadge(count: number): Promise<void> {
  const Notifications = await getNotifications();
  if (Notifications) await Notifications.setBadgeCountAsync(count);
}
export function listenPush(received: (data: any) => void, opened: (data: any) => void, rotated: () => void): () => void {
  let active = true;
  const subscriptions: Array<{ remove: () => void }> = [];
  void getNotifications().then(Notifications => {
    if (!active || !Notifications) return;
    subscriptions.push(
      Notifications.addNotificationReceivedListener(value => received(value.request.content.data)),
      Notifications.addNotificationResponseReceivedListener(value => { opened(value.notification.request.content.data); void Notifications.clearLastNotificationResponseAsync(); }),
      Notifications.addPushTokenListener(rotated),
    );
    void Notifications.getLastNotificationResponseAsync().then(value => {
      if (active && value) { opened(value.notification.request.content.data); void Notifications.clearLastNotificationResponseAsync(); }
    }).catch(() => {});
  }).catch(() => {});
  return () => { active = false; subscriptions.forEach(subscription => subscription.remove()); };
}
