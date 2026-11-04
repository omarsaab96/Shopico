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
  const [minutes, setMinutes] = useState(10);
  const acknowledge = useRef<() => void>(() => {});
  const endSession = useRef<() => void>(() => {});
  useEffect(() => {
    if (!user) { setOpen(false); return; }
    let active = true, ending = false, deadline = 0, warningMs = 0, dismissed = false, key = "", policyLoading = false, nextRetry = 0;
    const end = async () => {
      if (ending) return; ending = true;
      setOpen(false);
      try { await api.post("/auth/logout", {}, { timeout: 5000 }); } catch { /* Local logout must still complete offline. */ }
      if (active) { logout(); window.location.replace("/login"); }
    };
    endSession.current = () => { void end(); };
    acknowledge.current = () => { dismissed = true; sessionStorage.setItem(key, "true"); setOpen(false); };
    const tick = () => {
      if (!active || !deadline || ending || policyLoading) return;
      const remaining = deadline - Date.now();
      if (remaining <= 0) { void end(); return; }
      setMinutes(Math.max(1, Math.ceil(remaining / 60000)));
      if (!dismissed && remaining <= warningMs) setOpen(true);
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
  if (!user || !open) return null;
  return createPortal(<dialog ref={dialog} className="shipping-driver-dialog" aria-labelledby="session-expiry-title" onCancel={event => { event.preventDefault(); event.stopPropagation(); acknowledge.current(); }}>
    <div dir={ar ? "rtl" : "ltr"}>
      <h2 id="session-expiry-title">{ar ? "ستنتهي جلستك قريباً" : "Your session will end soon"}</h2>
      <p>{ar ? `ستنتهي جلستك خلال ${minutes} دقيقة. اختر تحديث الجلسة لتسجيل الخروج والدخول مجدداً.` : `Your session will end in ${minutes} minute${minutes === 1 ? "" : "s"}. Refresh session signs you out so you can log in again.`}</p>
      <div className="shipping-driver-actions"><button type="button" className="ghost-btn" onClick={() => acknowledge.current()}>{ar ? "حسناً، فهمت" : "OK, understood"}</button><button type="button" className="primary" onClick={() => endSession.current()}>{ar ? "تحديث الجلسة" : "Refresh session"}</button></div>
    </div>
  </dialog>, document.body);
}
