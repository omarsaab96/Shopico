import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import NotificationToasts from "./NotificationToasts";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { NotificationAlerts } from "../utils/notificationAlerts";
import { useBranch } from "../context/BranchContext";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";

interface Item { _id: string; type: string; title: { en: string; ar: string }; body: { en: string; ar: string }; readAt: string | null; createdAt: string; data: { orderId?: string; screen?: string } }

export default function Notifications() {
  const { selectedBranchId } = useBranch();
  const { user } = useAuth();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside, true);
    return () => document.removeEventListener("pointerdown", closeOutside, true);
  }, [open]);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Item[]>([]);
  const removeToast = useCallback((id: string) => setToasts(previous => previous.filter(item => item._id !== id)), []);
  const [, setStatus] = useState("connecting");
  const [error, setError] = useState("");
  const [sound, setSound] = useState(localStorage.getItem("notificationSound") === "true");
  const alerts = useRef<NotificationAlerts | null>(null);
  if (!alerts.current) alerts.current = new NotificationAlerts();
  const langRef = useRef(lang); langRef.current = lang;
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const scope = `${user?._id}:${selectedBranchId}`;
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const reload = async () => {
    const res = await api.get("/notifications", { headers: selectedBranchId ? { "x-branch-id": selectedBranchId } : {} });
    if (scopeRef.current !== scope) return;
    setItems(res.data.data.items); setUnread(res.data.data.unreadCount); setCursor(res.data.data.nextCursor);
  };
  useEffect(() => {
    if (!user) return;
    let cancelled = false, since = "";
    const seen = new Set<string>();
    const controller = new AbortController();
    setItems([]); setUnread(0); setToasts([]); setError("");
    alerts.current?.clearDesktop();
    const refresh = async () => { if (!cancelled) { try { await reload(); } catch { if (!cancelled) setError(ar ? "تعذر تحميل الإشعارات" : "Could not load notifications"); } } };
    const connect = async () => {
      while (!cancelled) {
        try {
          setStatus("connecting");
          const response = await fetch(`${api.defaults.baseURL}/notifications/stream${since ? `?since=${since}` : ""}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem("accessToken") || ""}`, ...(selectedBranchId ? { "x-branch-id": selectedBranchId } : {}) }, signal: controller.signal,
          });
          if (response.status === 401) await api.get("/auth/me");
          if (!response.ok || !response.body) throw new Error("Stream unavailable");
          setStatus("connected");
          const reader = response.body.getReader();
          const decoder = new TextDecoder(); let buffer = "";
          while (!cancelled) {
            const chunk = await reader.read(); if (chunk.done) break;
            buffer += decoder.decode(chunk.value, { stream: true });
            let end: number;
            while ((end = buffer.indexOf("\n\n")) >= 0) {
              const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
              const raw = frame.split("\n").find(line => line.startsWith("data: "))?.slice(6);
              if (!raw) continue;
              const value = JSON.parse(raw);
              if (frame.includes("event: ready")) { since = value.cursor || since; await refresh(); continue; }
              if (frame.includes("event: notification")) {
                since = value._id;
                if (seen.has(value._id)) continue;
                seen.add(value._id);
                if (seen.size > 500) seen.delete(seen.values().next().value!);
                if (document.visibilityState === "visible" && document.hasFocus()) {
                  setToasts(previous => [...previous, value]);
                }
                void refresh();
                window.dispatchEvent(new CustomEvent("shopico:notification", { detail: value }));
                if (soundRef.current) void alerts.current?.play().catch(() => setError("Could not play notification sound. Click the speaker to try again."));
                alerts.current?.show(value, langRef.current, () => {
                  if (scopeRef.current === scope) void read(value);
                });
              }
            }
          }
        } catch { /* Reconnect below; the cursor replays missed alerts. */ }
        if (cancelled) break;
        setStatus("reconnecting");
        await new Promise<void>(resolve => { const timer = window.setTimeout(resolve, 5000); controller.signal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true }); });
      }
    };
    void connect();
    return () => { cancelled = true; controller.abort(); };
  }, [user?._id, selectedBranchId]);
  useEffect(() => {
    const unlock = () => { if (soundRef.current) void alerts.current?.unlock().catch(() => {}); };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      alerts.current?.dispose();
    };
  }, []);
  const requestDesktop = () => {
    if ("Notification" in window && window.isSecureContext && Notification.permission === "default") {
      void Notification.requestPermission().catch(() => setError("Could not enable browser notifications."));
    }
  };
  const toggleSound = () => {
    const enabled = !sound;
    setSound(enabled); soundRef.current = enabled;
    localStorage.setItem("notificationSound", String(enabled));
    if (enabled) {
      setError("");
      void alerts.current?.play().catch(() => setError("Could not play notification sound. Click the speaker to try again."));
      requestDesktop();
    }
  };
  const read = async (item: Item) => {
    try {
      await api.put(`/notifications/${item._id}/read`); await reload();
      setOpen(false); removeToast(item._id);
      if (item.data.orderId) navigate(`/orders/${item.data.orderId}`);
      else if (item.data.screen === "wallet") navigate("/wallet");
    } catch { setError(ar ? "تعذر تحديث الإشعار" : "Could not update notification"); }
  };
  return <div ref={root} className="notification-root" dir={ar ? "rtl" : "ltr"}>
    <button className="ghost-btn dark icon notification-trigger" type="button" aria-expanded={open} aria-controls="notification-panel" aria-label={ar ? "الإشعارات" : "Notifications"} onClick={() => { setOpen(!open); requestDesktop(); if (sound) void alerts.current?.unlock().catch(() => {}); }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </svg>
      {unread > 0 && <span className="notification-badge">{unread > 99 ? "99+" : unread}</span>}
    </button>
    <section id="notification-panel" className={`notification-panel${open ? " is-open" : ""}`} inert={!open} aria-hidden={!open} aria-label={ar ? "الإشعارات" : "Notifications"}>
      <div className="notification-heading">
        <strong>{ar ? "الإشعارات" : "Notifications"}</strong>
        <div className="notification-actions">
          <button className="ghost-btn dark icon notification-action" type="button" disabled={!unread} title={ar ? "قراءة الكل" : "Mark all as read"} aria-label={ar ? "قراءة الكل" : "Mark all as read"} onClick={() => { void api.put("/notifications/read-all").then(reload).catch(() => setError(ar ? "تعذر التحديث" : "Could not mark as read")); }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 12 4 4L17 6M11 16l2 2L23 8" /></svg>
          </button>
          <button className="ghost-btn dark icon notification-action" type="button" aria-pressed={sound} title={sound ? (ar ? "كتم الصوت" : "Mute notifications") : (ar ? "تشغيل الصوت" : "Enable notification sound")} aria-label={ar ? "صوت الإشعارات" : "Notification sound"} onClick={toggleSound}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m11 5-6 4H2v6h3l6 4z" />{sound ? <><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" /></> : <path d="m16 9 6 6m0-6-6 6" />}</svg>
          </button>
          <button className="ghost-btn dark icon notification-action" type="button" onClick={() => setOpen(false)} title={ar ? "إغلاق" : "Close"} aria-label={ar ? "إغلاق" : "Close"}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
      </div>
      {/* <div className="notification-controls"><span role="status">{status === "connected" ? (ar ? "متصل" : "Connected") : (ar ? "جارٍ الاتصال" : "Reconnecting...")}</span></div> */}
      {error && <p role="alert">{error}</p>}
      <div className="notification-list">{items.length === 0 && <p className="muted">{ar ? "لا توجد إشعارات" : "No new notifications"}</p>}{items.map(item => <button key={item._id} className={`notification-item ${item.readAt ? "" : "unread"}`} onClick={() => void read(item)}><strong>{item.title[ar ? "ar" : "en"]}</strong><span>{item.body[ar ? "ar" : "en"]}</span><small>{new Date(item.createdAt).toLocaleString(ar ? "ar" : "en")}</small></button>)}</div>
      {cursor && <button className="ghost-btn" onClick={() => { void api.get(`/notifications?before=${cursor}`).then(res => { setItems(prev => [...prev, ...res.data.data.items]); setCursor(res.data.data.nextCursor); }).catch(() => setError(ar ? "تعذر التحميل" : "Could not load more")); }}>{ar ? "المزيد" : "Load more"}</button>}
    </section>
    {createPortal(<NotificationToasts items={toasts} ar={ar} onRemove={removeToast} onRead={id => {
      const item = toasts.find(value => value._id === id);
      if (item) void read(item);
    }} />, document.body)}
  </div>;
}
