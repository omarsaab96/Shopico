import { ModalContent } from "./ModalSurface";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import api from "../api/client";
import { useI18n } from "../context/I18nContext";

export default function ShippingDriverModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: (driverId: string) => Promise<boolean> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [drivers, setDrivers] = useState<{ _id: string; name: string; driverStatus?: string }[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
    let active = true;
    void api.get("/orders/drivers").then(res => { if (active) setDrivers(res.data.data); }).catch(() => { if (active) setError(ar ? "تعذر تحميل السائقين" : "Could not load drivers"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const submit = async () => {
    if (!selected || saving) return;
    setSaving(true); setError("");
    try { if (!await onConfirm(selected)) setError(ar ? "تعذر تحديث الطلب. حاول مجدداً." : "Could not update the order. Please retry."); }
    catch (err: any) { setError(err?.response?.data?.message || (ar ? "تعذر تحديث الطلب" : "Could not update order")); }
    finally { setSaving(false); }
  };
  return createPortal(<dialog ref={dialog} className="shipping-driver-dialog" aria-labelledby="shipping-driver-title" onCancel={event => { event.preventDefault(); event.stopPropagation(); if (!saving) onCancel(); }}><ModalContent>
    <form onSubmit={event => { event.preventDefault(); void submit(); }} dir={ar ? "rtl" : "ltr"}>
      <h2 id="shipping-driver-title">{ar ? "اختر سائقاً للتوصيل" : "Choose a delivery driver"}</h2>
      <div className="form">
        <p style={{ margin: 0 }}>{ar ? "يجب تعيين سائق قبل نقل الطلب إلى الشحن. الإلغاء يُبقي الحالة الأصلية." : "Assign a driver before moving this order to shipping. Cancelling keeps its original status."}</p>
        {loading ? <p role="status">{ar ? "جارٍ التحميل…" : "Loading drivers…"}</p> : <label>{ar ? "السائق" : "Driver"}
          <select autoFocus required value={selected} disabled={saving} onChange={event => setSelected(event.target.value)}><option value="">{ar ? "اختر سائقاً" : "Select a driver"}</option>{drivers.map(driver => <option key={driver._id} value={driver._id}>{driver.name}{driver.driverStatus === "BUSY" ? (ar ? " — مشغول" : " — Busy") : ""}</option>)}</select></label>}
        {!loading && !error && !drivers.length && <p>{ar ? "لا يوجد سائقون في هذا الفرع." : "No drivers are available in this branch."}</p>}
        {error && <p role="alert">{error}</p>}
      </div>
      <div className="shipping-driver-actions">
        <button type="button" className="ghost-btn" disabled={saving} onClick={onCancel}>{ar ? "إلغاء" : "Cancel"}</button><button type="submit" className="primary" disabled={loading || saving || !selected}>{saving ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "تعيين وشحن" : "Assign and ship")}</button></div>
    </form>
  </ModalContent></dialog>, document.body);
}
