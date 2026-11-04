import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
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
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [toast, setToast] = useState<Item | null>(null);
  const [status, setStatus] = useState("connecting");
  const [error, setError] = useState("");
  const [sound, setSound] = useState(localStorage.getItem("notificationSound") === "true");
  const audio = useRef<AudioContext | null>(null);
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
    const controller = new AbortController();
    setItems([]); setUnread(0); setToast(null); setError("");
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
                setToast(value); void refresh();
                window.dispatchEvent(new CustomEvent("shopico:notification", { detail: value }));
                if (soundRef.current && value.type === "ORDER_CREATED" && audio.current) {
                  try { await audio.current.resume(); const oscillator = audio.current.createOscillator(); const gain = audio.current.createGain(); gain.gain.value = 0.12; oscillator.frequency.value = 880; oscillator.connect(gain); gain.connect(audio.current.destination); oscillator.start(); oscillator.stop(audio.current.currentTime + 0.3); } catch { /* Browser may suspend audio until user interaction. */ }
                }
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
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 8000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => () => { void audio.current?.close(); }, []);
  const read = async (item: Item) => {
    try {
      await api.put(`/notifications/${item._id}/read`); await reload();
      setOpen(false); setToast(null);
      if (item.data.orderId) navigate(`/orders/${item.data.orderId}`);
      else if (item.data.screen === "wallet") navigate("/wallet");
    } catch { setError(ar ? "تعذر تحديث الإشعار" : "Could not update notification"); }
  };
  return <div className="notification-root" dir={ar ? "rtl" : "ltr"}>
    <button className="ghost-btn" aria-expanded={open} aria-label={ar ? "الإشعارات" : "Notifications"} onClick={() => { setOpen(!open); if (sound && !audio.current) { audio.current = new AudioContext(); void audio.current.resume(); } }}>🔔 {ar ? "الإشعارات" : "Notifications"} {unread > 0 && <span className="notification-badge">{unread > 99 ? "99+" : unread}</span>}</button>
    {open && <section className="notification-panel" aria-label={ar ? "الإشعارات" : "Notifications"}>
      <div className="notification-heading"><strong>{ar ? "الإشعارات" : "Notifications"}</strong><button className="ghost-btn" onClick={() => setOpen(false)} aria-label={ar ? "إغلاق" : "Close"}>×</button></div>
      <div className="notification-controls"><span role="status">{status === "connected" ? (ar ? "متصل" : "Live") : (ar ? "جارٍ الاتصال…" : "Reconnecting…")}</span><label><input type="checkbox" checked={sound} onChange={e => { setSound(e.target.checked); localStorage.setItem("notificationSound", String(e.target.checked)); if (e.target.checked) { audio.current ||= new AudioContext(); void audio.current.resume(); } }} /> {ar ? "الصوت" : "Sound"}</label></div>
      <button className="ghost-btn" disabled={!unread} onClick={() => { void api.put("/notifications/read-all").then(reload).catch(() => setError(ar ? "تعذر التحديث" : "Could not mark as read")); }}>{ar ? "قراءة الكل" : "Mark all as read"}</button>
      {error && <p role="alert">{error}</p>}
      <div className="notification-list">{items.length === 0 && <p className="muted">{ar ? "لا توجد إشعارات" : "No notifications yet"}</p>}{items.map(item => <button key={item._id} className={`notification-item ${item.readAt ? "" : "unread"}`} onClick={() => void read(item)}><strong>{item.title[ar ? "ar" : "en"]}</strong><span>{item.body[ar ? "ar" : "en"]}</span><small>{new Date(item.createdAt).toLocaleString(ar ? "ar" : "en")}</small></button>)}</div>
      {cursor && <button className="ghost-btn" onClick={() => { void api.get(`/notifications?before=${cursor}`).then(res => { setItems(prev => [...prev, ...res.data.data.items]); setCursor(res.data.data.nextCursor); }).catch(() => setError(ar ? "تعذر التحميل" : "Could not load more")); }}>{ar ? "المزيد" : "Load more"}</button>}
    </section>}
    {toast && <div className="notification-toast" role="status"><button className="notification-item" onClick={() => void read(toast)}><strong>{toast.title[ar ? "ar" : "en"]}</strong><span>{toast.body[ar ? "ar" : "en"]}</span></button><button className="ghost-btn" onClick={() => setToast(null)} aria-label={ar ? "إغلاق" : "Dismiss"}>×</button></div>}
  </div>;
}
