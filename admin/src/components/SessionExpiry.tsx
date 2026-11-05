import { ModalContent } from "./ModalSurface";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";

export default function SessionExpiry() {
  const { user, logout } = useAuth();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const acknowledge = useRef<() => void>(() => {});
  const endSession = useRef<() => void>(() => {});
  useEffect(() => {
    if (!user) { setOpen(false); setMinimized(false); return; }
    let active = true, ending = false, deadline = 0, warningMs = 0, dismissed = false, key = "", policyLoading = false, nextRetry = 0;
    const end = async () => {
      if (ending) return; ending = true;
      setOpen(false);
      setMinimized(false);
      try { await api.post("/auth/logout", {}, { timeout: 5000 }); } catch { /* Local logout must still complete offline. */ }
      if (active) { logout(); window.location.replace("/login"); }
    };
    endSession.current = () => { void end(); };
    acknowledge.current = () => { dismissed = true; sessionStorage.setItem(key, "true"); setMinimized(true); setOpen(false); };
    const tick = () => {
      if (!active || !deadline || ending || policyLoading) return;
      const remaining = deadline - Date.now();
      setRemainingSeconds(Math.max(0, Math.ceil(remaining / 1000)));
      if (remaining <= 0) { void end(); return; }
      if (remaining <= warningMs) {
        if (dismissed) setMinimized(true);
        else setOpen(true);
      }
    };
    const load = async () => {
      if (policyLoading || Date.now() < nextRetry) return;
      policyLoading = true;
      try {
        const res = await api.get("/auth/session");
        if (!active) return;
        const info = res.data.data;
        deadline = Date.now() + info.expiresAt - info.serverNow;
        warningMs = info.warningMinutes * 60000;
        key = `session-warning:${user._id}:${info.expiresAt}`;
        dismissed = sessionStorage.getItem(key) === "true";
        tick();
      } catch { /* Retry when the tab is focused or on the interval below. */ }
      finally { policyLoading = false; nextRetry = Date.now() + 30000; }
    };
    void load();
    const timer = setInterval(() => { if (deadline) tick(); else void load(); }, 1000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", tick); document.removeEventListener("visibilitychange", tick); };
  }, [user?._id]);
  useEffect(() => { if (open) dialog.current?.showModal(); }, [open]);
  if (!user) return null;
  const countdown = `${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(remainingSeconds % 60).padStart(2, "0")}`;
  return <>
    {minimized && !open && <button type="button" className={`session-countdown-mini${remainingSeconds <= 60 ? " urgent" : ""}`} title={ar ? "عرض تحذير انتهاء الجلسة" : "Open session expiry warning"} aria-label={ar ? `الوقت المتبقي للجلسة ${countdown}. عرض التحذير` : `Session time remaining ${countdown}. Open warning`} onClick={() => setOpen(true)}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
      <span role="timer" aria-live="off" dir="ltr">{countdown}</span>
    </button>}
    {open && createPortal(<dialog ref={dialog} className="shipping-driver-dialog" aria-labelledby="session-expiry-title" onCancel={event => { event.preventDefault(); event.stopPropagation(); acknowledge.current(); }}><ModalContent>
    <div dir={ar ? "rtl" : "ltr"}>
      <h2 id="session-expiry-title">{ar ? "ستنتهي جلستك قريباً" : "Your session will end soon"}</h2>
      <div className={`session-countdown${remainingSeconds <= 60 ? " urgent" : ""}`}>
        <span className="session-countdown-label">{ar ? "الوقت المتبقي" : "Time remaining"}</span>
        <div role="timer" aria-live="off" aria-label={ar ? "الوقت المتبقي حتى انتهاء الجلسة" : "Time until session expires"} className="session-countdown-value" dir="ltr">{countdown}</div>
        <span className="session-countdown-units">{ar ? "دقائق : ثوانٍ" : "minutes : seconds"}</span>
      </div>
      <p>{ar ? "عند انتهاء الوقت سيتم تسجيل خروجك. اختر تحديث الجلسة لتسجيل الخروج والدخول مجدداً الآن." : "You will be signed out when the timer reaches zero. Choose Refresh session to sign out and log in again now."}</p>
      <div className="shipping-driver-actions"><button type="button" className="ghost-btn" onClick={() => acknowledge.current()}>{ar ? "حسناً، فهمت" : "OK, understood"}</button><button type="button" className="primary" onClick={() => endSession.current()}>{ar ? "تحديث الجلسة" : "Refresh session"}</button></div>
    </div>
  </ModalContent></dialog>, document.body)}
  </>;
}
