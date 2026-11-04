import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, DeviceEventEmitter } from "react-native";
import { useRouter } from "expo-router";
import api from "./api";
import { useAuth } from "./auth";
import { useI18n } from "./i18n";
import { listenPush, registerPush, updateBadge } from "./push";

export interface NotificationItem { _id: string; type: string; title: { en: string; ar: string }; body: { en: string; ar: string }; createdAt: string; readAt: string | null; data: { orderId?: string; screen?: string } }
interface Value {
  items: NotificationItem[]; unreadCount: number; loading: boolean; error: string;
  pushEnabled: boolean; promotionsEnabled: boolean; pushStatus: string;
  refresh: () => Promise<void>; loadMore: () => Promise<void>; hasMore: boolean;
  open: (item: NotificationItem) => Promise<void>; readAll: () => Promise<void>;
  setPreference: (name: "pushEnabled" | "promotionsEnabled", enabled: boolean) => Promise<void>;
  enablePush: () => Promise<void>;
}
const Context = createContext<Value | null>(null);
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pushEnabled, setPushEnabled] = useState(true);
  const [promotionsEnabled, setPromotionsEnabled] = useState(true);
  const [pushStatus, setPushStatus] = useState("");
  const currentUser = useRef(user?._id); currentUser.current = user?._id;
  const latestSeen = useRef<string | undefined>(undefined);
  const errorText = lang === "ar" ? "تعذر تحميل الإشعارات. حاول مجدداً." : "Could not load notifications. Please retry.";
  const refresh = useCallback(async () => {
    if (!user) return;
    const id = user._id;
    try {
      const res = await api.get("/notifications");
      if (currentUser.current !== id) return;
      const latest = res.data.data.items[0]?._id;
      if (latestSeen.current && latest && latest !== latestSeen.current) DeviceEventEmitter.emit("shopico:notification");
      latestSeen.current = latest;
      setItems(res.data.data.items); setUnreadCount(res.data.data.unreadCount); setCursor(res.data.data.nextCursor); setError("");
      void updateBadge(res.data.data.unreadCount).catch(() => {});
    } catch { if (currentUser.current === id) setError(errorText); }
  }, [user?._id, errorText]);
  const navigateData = useCallback((data: NotificationItem["data"]) => {
    if (data?.orderId && /^[a-f\d]{24}$/i.test(data.orderId)) router.push((user?.role === "driver" ? `/driver-orders/${data.orderId}` : `/orders/${data.orderId}`) as any);
    else if (data?.screen === "wallet") router.push("/wallet");
    else if (data?.screen === "points") router.push("/points");
    else if (data?.screen === "membership") router.push("/membership");
    else router.push("/home");
  }, [user?.role, router]);
  const enablePush = useCallback(async () => { setPushStatus(await registerPush(lang, true)); }, [lang]);
  useEffect(() => {
    setItems([]); setUnreadCount(0); setCursor(null); setError(""); setPushStatus("");
    latestSeen.current = undefined;
    if (!user) return;
    let active = true;
    setLoading(true);
    void refresh().finally(() => { if (active) setLoading(false); });
    const register = async (request = false) => {
      try {
        const res = await api.get("/notifications/preferences");
        if (!active) return;
        setPushEnabled(res.data.data.pushEnabled); setPromotionsEnabled(res.data.data.promotionsEnabled);
        if (res.data.data.pushEnabled) { const status = await registerPush(lang, request); if (active) setPushStatus(status); }
      } catch { if (active) setPushStatus("error"); }
    };
    void register(true);
    const emitUpdate = () => { void refresh(); DeviceEventEmitter.emit("shopico:notification"); };
    const stopPush = listenPush(emitUpdate, data => {
      // Fetch the authorized inbox item before navigating a push payload.
      if (!data?.notificationId || !/^[a-f\d]{24}$/i.test(String(data.notificationId))) return;
      void api.put(`/notifications/${data.notificationId}/read`).then(res => { if (active) { navigateData(res.data.data.data); emitUpdate(); } }).catch(() => {});
    }, () => { void register(); });
    const appState = AppState.addEventListener("change", state => { if (state === "active") { emitUpdate(); void register(); } });
    const renewed = DeviceEventEmitter.addListener("shopico:session-renewed", () => { void register(); });
    const timer = setInterval(() => { if (AppState.currentState === "active") void refresh(); }, 30000);
    return () => { active = false; clearInterval(timer); appState.remove(); renewed.remove(); stopPush(); };
  }, [user?._id, lang, refresh, navigateData]);
  const setPreference = async (name: "pushEnabled" | "promotionsEnabled", enabled: boolean) => {
    const res = await api.put("/notifications/preferences", { [name]: enabled });
    setPushEnabled(res.data.data.pushEnabled); setPromotionsEnabled(res.data.data.promotionsEnabled);
    if (name === "pushEnabled" && enabled) await enablePush();
  };
  const loadMore = async () => {
    if (!cursor || loading) return;
    setLoading(true);
    try { const res = await api.get(`/notifications?before=${cursor}`); setItems(prev => [...prev, ...res.data.data.items.filter((item: NotificationItem) => !prev.some(old => old._id === item._id))]); setCursor(res.data.data.nextCursor); }
    catch { setError(errorText); } finally { setLoading(false); }
  };
  const open = async (item: NotificationItem) => {
    await api.put(`/notifications/${item._id}/read`); await refresh(); navigateData(item.data);
  };
  const readAll = async () => { await api.put("/notifications/read-all"); await refresh(); };
  return <Context.Provider value={{ items, unreadCount, loading, error, pushEnabled, promotionsEnabled, pushStatus, refresh, loadMore, hasMore: !!cursor, open, readAll, setPreference, enablePush }}>{children}</Context.Provider>;
}
export function useNotifications() { const value = useContext(Context); if (!value) throw new Error("NotificationProvider missing"); return value; }
