import ModalSurface from "../components/ModalSurface";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import Card from "../components/Card";
import type { Branch } from "../types/api";
import { deleteBranch, fetchBranches, saveBranch } from "../api/client";
import { useI18n } from "../context/I18nContext";
import { usePermissions } from "../hooks/usePermissions";
import { useAuth } from "../context/AuthContext";
import { useBranch } from "../context/BranchContext";
import { confirmDelete } from "../utils/confirm";

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
const DEFAULT_CENTER = { lat: 33.5138, lng: 36.2765 };

const loadGoogleMaps = (() => {
  let promise: Promise<void> | null = null;
  return (key?: string) => {
    if (typeof window !== "undefined" && (window as any).google?.maps) return Promise.resolve();
    if (!key) return Promise.reject(new Error("Google Maps key missing"));
    if (promise) return promise;
    promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Google Maps"));
      document.head.appendChild(script);
    });
    return promise;
  };
})();

const formatNumber = (value?: number) => (value === undefined || Number.isNaN(value) ? "" : String(value));
const normalizeBoolean = (value: unknown, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") return value === "true" || value === "1";
  return fallback;
};

const BranchLocationPicker = ({
  isOpen,
  value,
  onChange,
  mapsReady,
  mapsError,
  compact = false,
}: {
  isOpen: boolean;
  value: { lat?: number; lng?: number; address?: string };
  onChange: (next: { lat?: number; lng?: number; address?: string }) => void;
  mapsReady: boolean;
  mapsError: string;
  compact?: boolean;
}) => {
  const { t } = useI18n();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [locationError, setLocationError] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !mapsReady || !mapRef.current) return;
    const google = (window as any).google;
    const center = {
      lat: value.lat ?? DEFAULT_CENTER.lat,
      lng: value.lng ?? DEFAULT_CENTER.lng,
    };
    mapInstanceRef.current = new google.maps.Map(mapRef.current, {
      center,
      zoom: value.lat && value.lng ? 14 : 11,
      disableDefaultUI: true,
      zoomControl: true,
    });
    markerRef.current = new google.maps.Marker({ map: mapInstanceRef.current, position: center });

    mapInstanceRef.current.addListener("click", (e: any) => {
      const next = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      onChange({ ...value, ...next });
      reverseGeocode(next.lat, next.lng);
    });

    if (searchRef.current) {
      const autocomplete = new google.maps.places.Autocomplete(searchRef.current, {
        fields: ["geometry", "formatted_address", "name"],
      });
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const location = place?.geometry?.location;
        if (!location) return;
        const next = { lat: location.lat(), lng: location.lng() };
        const address = place.formatted_address || place.name || value.address;
        onChange({ ...value, ...next, address });
        mapInstanceRef.current?.setCenter(next);
        markerRef.current?.setPosition(next);
      });
    }
  }, [isOpen, mapsReady]);

  useEffect(() => {
    if (!mapsReady) return;
    const next = {
      lat: value.lat ?? DEFAULT_CENTER.lat,
      lng: value.lng ?? DEFAULT_CENTER.lng,
    };
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter(next);
    }
    if (markerRef.current) {
      markerRef.current.setPosition(next);
    }
  }, [mapsReady, value.lat, value.lng]);

  const reverseGeocode = async (lat: number, lng: number) => {
    const google = (window as any).google;
    if (google?.maps?.Geocoder) {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results: any, status: string) => {
        if (status === "OK" && results?.[0]?.formatted_address) {
          onChange({ ...value, lat, lng, address: results[0].formatted_address });
        }
      });
      return;
    }
    if (!GOOGLE_MAPS_KEY) return;
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_KEY}`
      );
      const json = await res.json();
      const formatted = json?.results?.[0]?.formatted_address;
      if (formatted) {
        onChange({ ...value, lat, lng, address: formatted });
      }
    } catch {
      // ignore
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError(t("branches.geolocationNotSupported"));
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocationError("");
        onChange({ ...value, ...next });
        mapInstanceRef.current?.setCenter(next);
        markerRef.current?.setPosition(next);
        reverseGeocode(next.lat, next.lng);
        setLocationLoading(false);
      },
      () => {
        setLocationError(t("branches.locationPermissionDenied"));
        setLocationLoading(false);
      }
    );
  };

  return (
    <div className="form">
      {!compact && (
        <label style={{ margin: 0 }}>
          {t("branches.location")}
        </label>
      )}
      <div className="flex align-center" style={{ gap: 10, alignItems: "center" }}>
        <input
          ref={searchRef}
          placeholder={t("branches.searchOnMap")}
          defaultValue=""
          disabled={!mapsReady}
          style={{ flex: 1 }}
        />
        <button
          className="ghost-btn flex"
          type="button"
          style={{ margin: 0, gap: 5, alignItems: 'center' }}
          onClick={useCurrentLocation}
          disabled={locationLoading}
        >
          {locationLoading ? <div className="spinner small" /> : <div className="currentLocIcon" />} {t("branches.useCurrentLocation")}
        </button>
      </div>

      {!compact && (
        <div className="flex align-center" style={{ gap: 10, marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <label>
              {t("latitude")}
              <input value={formatNumber(value.lat)} readOnly />
            </label>
          </div>
          <div style={{ flex: 1 }}>
            <label>
              {t("longitude")}
              <input value={formatNumber(value.lng)} readOnly />
            </label>
          </div>
        </div>
      )}
      {/* {compact && (
        <div className="muted" style={{ marginTop: 6 }}>
          {value.lat && value.lng ? `${formatNumber(value.lat)}, ${formatNumber(value.lng)}` : "No coordinates set"}
        </div>
      )} */}
      {mapsError && <div className="error">{mapsError}</div>}
      {locationError && <div className="error">{locationError}</div>}
      <div
        ref={mapRef}
        style={{
          height: compact ? 200 : 260,
          borderRadius: 12,
          border: "1px solid var(--border)",
          overflow: "hidden",
          background: "#f1f5f9",
        }}
      />
    </div>
  );
};

const OpeningHoursEditor = ({ value, onChange }: { value: Partial<Branch>; onChange: (value: Partial<Branch>) => void }) => {
  const scheduleId = useId();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const slots = value.openingHours || [];
  const days = ar ? ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"] : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return <div className="branch-opening-hours">
    <div className="checkboxContainer">
      <input id={scheduleId} type="checkbox" checked={value.openingHours != null} onChange={e => onChange({ ...value, openingHours: e.target.checked ? [] : null })} />
      <label htmlFor={scheduleId}>{ar ? "تحديد جدول أسبوعي" : "Set weekly opening hours"}</label>
    </div>
    {value.openingHours == null && <p className="muted branch-hours-hint">{ar ? "بدون جدول، يعتبر الفرع مفتوحاً طوال الوقت." : "Without a schedule, the branch is treated as always open."}</p>}
    {value.openingHours != null && <>
      <label>{ar ? "المنطقة الزمنية" : "Timezone"}<input required value={value.timeZone || "Asia/Damascus"} onChange={e => onChange({ ...value, timeZone: e.target.value })} placeholder="Asia/Damascus" /></label>
      <p className="muted branch-hours-hint">{ar ? "اليوم بدون فترات مغلق. وقت الإغلاق الأسبق يعني اليوم التالي." : "Days without slots are closed. A closing time earlier than opening ends the next day."}</p>
      <div className="branch-hours-week">{days.map((day, dayIndex) => <div key={dayIndex} className="branch-hours-day">
        <div className="branch-hours-day-header">
          <div className="branch-hours-day-title"><strong>{day}</strong>{!slots.some(slot => slot.day === dayIndex) && <span className="muted">{ar ? "مغلق" : "Closed"}</span>}</div>
          <button type="button" className="ghost-btn" onClick={() => onChange({ ...value, openingHours: [...slots, { day: dayIndex, start: "09:00", end: "18:00" }] })}>{ar ? "إضافة فترة" : "Add slot"}</button>
        </div>
        {slots.map((slot, index) => slot.day === dayIndex && <div key={index} className="branch-hours-slot">
          <label>{ar ? "من" : "From"}<input aria-label={`${day} ${ar ? "فتح" : "opening"}`} type="time" dir="ltr" required value={slot.start} onChange={e => onChange({ ...value, openingHours: slots.map((s, i) => i === index ? { ...s, start: e.target.value } : s) })} /></label>
          <label>{ar ? "إلى" : "To"}<input aria-label={`${day} ${ar ? "إغلاق" : "closing"}`} type="time" dir="ltr" required value={slot.end} onChange={e => onChange({ ...value, openingHours: slots.map((s, i) => i === index ? { ...s, end: e.target.value } : s) })} /></label>
          <button type="button" className="ghost-btn danger" aria-label={`${ar ? "حذف فترة" : "Remove slot"} ${day}`} onClick={() => onChange({ ...value, openingHours: slots.filter((_, i) => i !== index) })}>{ar ? "حذف" : "Remove"}</button>
          {slot.end < slot.start && <span className="muted branch-hours-overnight">{ar ? "ينتهي في اليوم التالي" : "Ends the next day"}</span>}
        </div>)}
      </div>)}
      </div>
    </>}
  </div>;
};

type BranchEditorTab = "info" | "location" | "hours";

const BranchesPage = () => {
  const editorFormId = useId();
  const [editorTab, setEditorTab] = useState<BranchEditorTab>("info");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [draft, setDraft] = useState<Partial<Branch>>({ isActive: true, deliveryRadiusKm: 5 });
  const [saving, setSaving] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Branch>>({});
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [editError, setEditError] = useState("");
  const { t, lang } = useI18n();
  const { can } = usePermissions();
  const { refreshProfile } = useAuth();
  const { refreshBranches } = useBranch();
  const canManage = can("branches:manage");
  const canView = can("branches:view") || canManage;
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsError, setMapsError] = useState("");

  const mapOpen = useMemo(() => showNewModal || Boolean(editingId), [showNewModal, editingId]);

  const getFilterParams = () => ({
    q: searchTerm.trim() || undefined,
  });

  const load = async (params?: { q?: string }) => {
    if (!canView) return;
    setLoading(true);
    try {
      const data = await fetchBranches(params);
      setBranches(data.map((b) => ({ ...b, isActive: normalizeBoolean(b.isActive, true) })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(getFilterParams());
  }, [canView]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!canManage) return;
    setSaving(true);
    try {
      setFormError("");
      if (draft.lat === undefined || draft.lng === undefined || Number.isNaN(draft.lat) || Number.isNaN(draft.lng)) {
        setEditorTab("location");
        setFormError(t("branches.selectLocationOnMap"));
        return;
      }
      const saved = await saveBranch({ ...draft, openingHours: draft.openingHours ?? null });
      setBranches((prev) => [saved, ...prev]);
      await refreshProfile();
      await refreshBranches();
      setDraft({ isActive: true, deliveryRadiusKm: 5 });
      setShowNewModal(false);
      load(getFilterParams());
    } catch (err: any) {
      const field = err?.response?.data?.errors?.[0]?.path?.[0];
      if (field === "openingHours" || field === "timeZone") setEditorTab("hours");
      else if (field === "address" || field === "lat" || field === "lng") setEditorTab("location");
      const message = err?.response?.data?.errors?.[0]?.message || err?.response?.data?.message || t("branches.couldNotSave");
      setFormError(message);
    } finally { setSaving(false); }
  };

  const startEdit = (branch: Branch) => {
    if (!canManage) return;
    setEditorTab("info");
    setShowNewModal(false);
    setEditingId(branch._id);
    setEditDraft({ ...branch, isActive: normalizeBoolean(branch.isActive, true) });
    setEditError("");
  };

  const saveEdit = async () => {
    if (saving) return;
    if (!editingId) return;
    if (!canManage) return;
    setSaving(true);
    try {
      setEditError("");
      if (editDraft.lat === undefined || editDraft.lng === undefined || Number.isNaN(editDraft.lat) || Number.isNaN(editDraft.lng)) {
        setEditorTab("location");
        setEditError(t("branches.selectLocationOnMap"));
        return;
      }
      const saved = await saveBranch({
        ...editDraft,
        openingHours: editDraft.openingHours ?? null,
        _id: editingId,
        isActive: normalizeBoolean(editDraft.isActive, true),
      });
      const normalized = { ...saved, isActive: normalizeBoolean(saved.isActive, true) };
      setBranches((prev) => prev.map((b) => (b._id === saved._id ? normalized : b)));
      await refreshBranches();
      setEditingId(null);
      setEditDraft({});
      load(getFilterParams());
    } catch (err: any) {
      const field = err?.response?.data?.errors?.[0]?.path?.[0];
      if (field === "openingHours" || field === "timeZone") setEditorTab("hours");
      else if (field === "address" || field === "lat" || field === "lng") setEditorTab("location");
      const message = err?.response?.data?.errors?.[0]?.message || err?.response?.data?.message || t("branches.couldNotUpdate");
      setEditError(message);
    } finally { setSaving(false); }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({});
    setEditError("");
  };

  const openNewModal = () => {
    if (!canManage || saving) return;
    setEditorTab("info");
    cancelEdit();
    setDraft({ isActive: true, deliveryRadiusKm: 5 });
    setFormError("");
    setShowNewModal(true);
  };

  const closeNewModal = () => {
    setShowNewModal(false);
  };

  const applyFilters = () => load(getFilterParams());
  const resetFilters = () => {
    setSearchTerm("");
    load();
  };

  const removeBranch = async (id: string) => {
    if (!(await confirmDelete(t))) return;
    await deleteBranch(id);
    await refreshBranches();
    load(getFilterParams());
  };

  useEffect(() => {
    if (!mapOpen) return;
    loadGoogleMaps(GOOGLE_MAPS_KEY)
      .then(() => {
        setMapsReady(true);
        setMapsError("");
      })
      .catch((err) => {
        setMapsReady(false);
        setMapsError(err?.message || t("branches.googleMapsFailed"));
      });
  }, [mapOpen]);

  const modalDraft = editingId ? editDraft : draft;
  const setModalDraft = editingId ? setEditDraft : setDraft;
  const modalError = editingId ? editError : formError;
  const closeEditor = () => { if (saving) return; cancelEdit(); closeNewModal(); };

  return (
    <>
      <Card title={t("branches")} subTitle={`(${branches.length})`}>
        <div className="page-header">
          <form
            className="filters"
            onSubmit={(e) => {
              e.preventDefault();
              applyFilters();
            }}
          >
            <input
              className="filter-input"
              placeholder={t("searchBranch")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button className="primary" type="submit">
              {t("filter")}
            </button>
            <button className="ghost-btn" type="button" onClick={resetFilters}>
              {t("clear")}
            </button>
          </form>
          {canManage && (
            <button className="primary" onClick={openNewModal}>
              {t("addBranch")}
            </button>
          )}
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>{t("name")}</th>
              <th>{t("address")}</th>
              <th>{t("phone")}</th>
              {/* <th>{t("latitude")}</th>
              <th>{t("longitude")}</th> */}
              {/* <th>{t("openHours")}</th> */}
              <th>{t("deliveryRadiusKm")}</th>
              <th>{t("active")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="productRow">
                  <td><span className="skeleton-line w-140" /></td>
                  <td><span className="skeleton-line w-180" /></td>
                  <td><span className="skeleton-line w-120" /></td>
                  <td><span className="skeleton-line w-80" /></td>
                  <td><span className="skeleton-line w-60" /></td>
                  <td><span className="skeleton-line w-120" /></td>
                </tr>
              ))
            ) : branches.length === 0 ? (
              <tr>
                <td colSpan={9} className="muted">{t("noBranches")}</td>
              </tr>
            ) : (
              branches.map((branch) => (
                <tr key={branch._id} className="productRow">
                  <td>
                    {(
                      branch.name
                    )}
                  </td>
                  <td>
                    {(
                      branch.address
                    )}
                  </td>
                  <td>
                    {(
                      branch.phone || "-"
                    )}
                  </td>
                  <td>
                    {(
                      branch.deliveryRadiusKm
                    )}
                  </td>
                  <td>
                    {(
                      branch.isActive ? (t("yes") || "Yes") : (t("no") || "No")
                    )}
                  </td>
                  <td>
                    {canManage ? (
                      <div className="flex">
                        <button className="primary mr-10" onClick={() => startEdit(branch)}>
                          {t("edit")}
                        </button>
                        <button className="ghost-btn danger" onClick={() => removeBranch(branch._id)}>
                          {t("delete")}
                        </button>
                      </div>
                    ) : (
                      <div className="muted"></div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {(showNewModal || editingId) && canManage && (
        <div className="modal-backdrop" onClick={closeEditor}>
          <ModalSurface className="modal branch-edit-modal" aria-labelledby={`${editorFormId}-title`} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" id={`${editorFormId}-title`}>{t(editingId ? "editBranch" : "newBranch")}</div>
              <button className="ghost-btn" type="button" onClick={closeEditor} disabled={saving}>
                {t("close")}
              </button>
            </div>
            <div className="tab-row" role="tablist" aria-label={t(editingId ? "editBranch" : "newBranch")}>
              {(["info", "location", "hours"] as const).map((tab, index, tabs) => <button
                key={tab} type="button" role="tab" className={`tab-btn ${editorTab === tab ? "active" : ""}`}
                id={`${editorFormId}-${tab}-tab`} aria-controls={`${editorFormId}-${tab}-panel`} aria-selected={editorTab === tab} tabIndex={editorTab === tab ? 0 : -1}
                onClick={() => setEditorTab(tab)}
                onKeyDown={event => {
                  const step = event.key === "ArrowRight" ? (lang === "ar" ? -1 : 1) : event.key === "ArrowLeft" ? (lang === "ar" ? 1 : -1) : 0;
                  const next = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs[2] : step ? tabs[(index + step + tabs.length) % tabs.length] : null;
                  if (!next) return;
                  event.preventDefault(); setEditorTab(next); document.getElementById(`${editorFormId}-${next}-tab`)?.focus();
                }}
              >{tab === "info" ? (lang === "ar" ? "معلومات" : "Info") : tab === "location" ? t("branches.location") : (lang === "ar" ? "ساعات العمل" : "Opening hours")}</button>)}
            </div>
            <form id={editorFormId} className="form branch-editor-form" noValidate onSubmit={event => {
              event.preventDefault();
              const form = event.currentTarget;
              const invalid = form.querySelector<HTMLInputElement>("input:invalid");
              if (invalid) {
                setEditorTab(invalid.closest<HTMLElement>("[data-branch-tab]")?.dataset.branchTab as BranchEditorTab || "info");
                requestAnimationFrame(() => invalid.reportValidity());
                return;
              }
              if (editingId) void saveEdit(); else void submit(event);
            }}>
              <div role="tabpanel" id={`${editorFormId}-info-panel`} aria-labelledby={`${editorFormId}-info-tab`} data-branch-tab="info" hidden={editorTab !== "info"}>
              <div className="branch-info-grid">
                <label style={{ flex: 1 }}>
                  {t("name")}
                  <input autoFocus value={modalDraft.name || ""} onChange={(e) => setModalDraft({ ...modalDraft, name: e.target.value })} required />
                </label>
                <label style={{ flex: 1 }}>
                  {t("phone")}
                  <input value={modalDraft.phone || ""} onChange={(e) => setModalDraft({ ...modalDraft, phone: e.target.value })} />
                </label>
                <label style={{ flex: 1 }}>
                  {t("deliveryRadiusKm")}
                  <input
                    type="number"
                    value={modalDraft.deliveryRadiusKm ?? ""}
                    onChange={(e) =>
                      setModalDraft({ ...modalDraft, deliveryRadiusKm: e.target.value ? Number(e.target.value) : undefined })
                    }
                  />
                </label>
              </div>
              <div className="checkboxContainer">
                <input id="branchActiveNew" type="checkbox" checked={Boolean(modalDraft.isActive)} onChange={(e) => setModalDraft({ ...modalDraft, isActive: e.target.checked })} />
                <label htmlFor="branchActiveNew">{t("active")}</label>
              </div>
              </div>
              <div role="tabpanel" id={`${editorFormId}-location-panel`} aria-labelledby={`${editorFormId}-location-tab`} data-branch-tab="location" hidden={editorTab !== "location"}>
              <label>
                {t("address")}
                <input required value={modalDraft.address || ""} onChange={(e) => setModalDraft({ ...modalDraft, address: e.target.value })} />
              </label>
              <BranchLocationPicker
                isOpen={editorTab === "location"}
                value={{ lat: modalDraft.lat, lng: modalDraft.lng, address: modalDraft.address }}
                onChange={(next) =>
                  setModalDraft((prev) => ({ ...prev, lat: next.lat, lng: next.lng, address: next.address }))
                }
                mapsReady={mapsReady}
                mapsError={mapsError}
              />

              </div>
              <div role="tabpanel" id={`${editorFormId}-hours-panel`} aria-labelledby={`${editorFormId}-hours-tab`} data-branch-tab="hours" hidden={editorTab !== "hours"}>
                <OpeningHoursEditor value={modalDraft} onChange={setModalDraft} />
              </div>
              {modalError && <div className="error" role="alert">{modalError}</div>}
              
            </form>
            <div className="modal-actions">
                <button className="ghost-btn" type="button" onClick={closeEditor} disabled={saving}>
                  {t("cancel")}
                </button>
                {canManage && (
                  <button className="primary" type="submit" form={editorFormId} disabled={saving}>
                    {t(saving ? "saving" : "save")}
                  </button>
                )}
              </div>
          </ModalSurface>
        </div>
      )}

    </>
  );
};

export default BranchesPage;
