import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import Card from "../components/Card";
import type { Branch } from "../types/api";
import { deleteBranch, fetchBranches, saveBranch } from "../api/client";
import { useI18n } from "../context/I18nContext";
import { usePermissions } from "../hooks/usePermissions";

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
  const mapRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [locationError, setLocationError] = useState("");

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
      setLocationError("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocationError("");
        onChange({ ...value, ...next });
        mapInstanceRef.current?.setCenter(next);
        markerRef.current?.setPosition(next);
        reverseGeocode(next.lat, next.lng);
      },
      () => setLocationError("Location permission denied")
    );
  };

  return (
    <div className="form">
      {!compact && (
        <label style={{ margin: 0 }}>
          Location
        </label>
      )}
      <div className="flex align-center" style={{ gap: 10, alignItems: "center" }}>
        <input
          ref={searchRef}
          placeholder="Search on map"
          defaultValue=""
          disabled={!mapsReady}
          style={{ flex: 1 }}
        />
        <button className="ghost-btn" type="button" style={{ margin: 0 }} onClick={useCurrentLocation}>
          Use current location
        </button>
      </div>

      {!compact && (
        <div className="flex align-center" style={{ gap: 10, marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <label>
              Lat
              <input value={formatNumber(value.lat)} readOnly />
            </label>
          </div>
          <div style={{ flex: 1 }}>
            <label>
              Lng
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

const BranchesPage = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [draft, setDraft] = useState<Partial<Branch>>({ isActive: true, deliveryRadiusKm: 5 });
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Branch>>({});
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [editError, setEditError] = useState("");
  const { t } = useI18n();
  const { can } = usePermissions();
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
    if (!canManage) return;
    try {
      setFormError("");
      if (draft.lat === undefined || draft.lng === undefined || Number.isNaN(draft.lat) || Number.isNaN(draft.lng)) {
        setFormError("Select a location on the map.");
        return;
      }
      const saved = await saveBranch(draft);
      setBranches((prev) => [saved, ...prev]);
      setDraft({ isActive: true, deliveryRadiusKm: 5 });
      setShowNewModal(false);
      load(getFilterParams());
    } catch (err: any) {
      const message = err?.response?.data?.message || "Could not save branch";
      setFormError(message);
    }
  };

  const startEdit = (branch: Branch) => {
    if (!canManage) return;
    setEditingId(branch._id);
    setEditDraft({ ...branch, isActive: normalizeBoolean(branch.isActive, true) });
    setEditError("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!canManage) return;
    try {
      setEditError("");
      if (editDraft.lat === undefined || editDraft.lng === undefined || Number.isNaN(editDraft.lat) || Number.isNaN(editDraft.lng)) {
        setEditError("Select a location on the map.");
        return;
      }
      const saved = await saveBranch({
        ...editDraft,
        _id: editingId,
        isActive: normalizeBoolean(editDraft.isActive, true),
      });
      const normalized = { ...saved, isActive: normalizeBoolean(saved.isActive, true) };
      setBranches((prev) => prev.map((b) => (b._id === saved._id ? normalized : b)));
      setEditingId(null);
      setEditDraft({});
      load(getFilterParams());
    } catch (err: any) {
      const message = err?.response?.data?.message || "Could not update branch";
      setEditError(message);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({});
    setEditError("");
  };

  const openNewModal = () => {
    if (!canManage) return;
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

  useEffect(() => {
    if (!mapOpen) return;
    loadGoogleMaps(GOOGLE_MAPS_KEY)
      .then(() => {
        setMapsReady(true);
        setMapsError("");
      })
      .catch((err) => {
        setMapsReady(false);
        setMapsError(err?.message || "Google Maps failed to load");
      });
  }, [mapOpen]);

  return (
    <>
      <Card title={t("branches")} subTitle={`(${branches.length})`}>
        <div className="page-header">
          <div className="filters">
            <input
              className="filter-input"
              placeholder={t("searchBranch")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button className="ghost-btn" type="button" onClick={applyFilters}>
              {t("filter")}
            </button>
            <button className="ghost-btn" type="button" onClick={resetFilters}>
              {t("clear")}
            </button>
          </div>
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
                    {editingId === branch._id ? (
                      <input value={editDraft.name || ""} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} />
                    ) : (
                      branch.name
                    )}
                  </td>
                  <td>
                    {editingId === branch._id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {/* <input
                          value={editDraft.address || ""}
                          onChange={(e) => setEditDraft({ ...editDraft, address: e.target.value })}
                        /> */}
                        {/* <div className="muted">
                          {editDraft.lat !== undefined && editDraft.lng !== undefined
                            ? `${formatNumber(editDraft.lat)}, ${formatNumber(editDraft.lng)}`
                            : "No coordinates set"}
                        </div> */}
                        <BranchLocationPicker
                          isOpen
                          compact
                          value={{ lat: editDraft.lat, lng: editDraft.lng, address: editDraft.address }}
                          onChange={(next) =>
                            setEditDraft((prev) => ({ ...prev, lat: next.lat, lng: next.lng, address: next.address }))
                          }
                          mapsReady={mapsReady}
                          mapsError={mapsError}
                        />
                      </div>
                    ) : (
                      branch.address
                    )}
                  </td>
                  <td>
                    {editingId === branch._id ? (
                      <input value={editDraft.phone || ""} onChange={(e) => setEditDraft({ ...editDraft, phone: e.target.value })} />
                    ) : (
                      branch.phone || "-"
                    )}
                  </td>
                  <td>
                    {editingId === branch._id ? (
                      <input
                        type="number"
                        value={editDraft.deliveryRadiusKm ?? ""}
                        onChange={(e) =>
                          setEditDraft({ ...editDraft, deliveryRadiusKm: e.target.value ? Number(e.target.value) : undefined })
                        }
                      />
                    ) : (
                      branch.deliveryRadiusKm
                    )}
                  </td>
                  <td>
                    {editingId === branch._id ? (
                      <div className="checkboxContainer">
                        <input
                          id={`branchActiveEdit${branch._id}`}
                          type="checkbox"
                          checked={Boolean(editDraft.isActive)}
                          onChange={(e) => setEditDraft((prev) => ({ ...prev, isActive: e.target.checked }))}
                        />
                        <label htmlFor={`branchActiveEdit${branch._id}`}></label>
                      </div>
                    ) : (
                      branch.isActive ? (t("yes") || "Yes") : (t("no") || "No")
                    )}
                  </td>
                  <td>
                    {editingId === branch._id ? (
                      <div className="flex">
                        <button className="ghost-btn" onClick={saveEdit}>
                          {t("save")}
                        </button>
                        <button className="ghost-btn" onClick={cancelEdit}>
                          {t("cancel")}
                        </button>
                        <button className="ghost-btn danger" onClick={() => deleteBranch(branch._id).then(() => load(getFilterParams()))}>
                          {t("delete")}
                        </button>
                        {editError && <div className="error">{editError}</div>}
                      </div>
                    ) : canManage ? (
                      <div className="flex">
                        <button className="ghost-btn mr-10" onClick={() => startEdit(branch)}>
                          {t("edit")}
                        </button>
                        <button className="ghost-btn danger" onClick={() => deleteBranch(branch._id).then(() => load(getFilterParams()))}>
                          {t("delete")}
                        </button>
                      </div>
                    ) : (
                      <div className="muted">{t("noPermissionAction")}</div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {showNewModal && canManage && (
        <div className="modal-backdrop" onClick={closeNewModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t("newBranch")}</div>
              <button className="ghost-btn" type="button" onClick={closeNewModal}>
                {t("close")}
              </button>
            </div>
            <form className="form" onSubmit={submit}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ flex:1 }}>
                  {t("name")}
                  <input value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
                </label>
                <label style={{ flex:1 }}>
                  {t("phone")}
                  <input value={draft.phone || ""} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
                </label>
                <label style={{ flex:1 }}>
                  {t("deliveryRadiusKm")}
                  <input
                    type="number"
                    value={draft.deliveryRadiusKm ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, deliveryRadiusKm: e.target.value ? Number(e.target.value) : undefined })
                    }
                  />
                </label>
              </div>
              <label style={{ display: 'none' }}>
                {t("address")}
                <input value={draft.address || ""} onChange={(e) => setDraft({ ...draft, address: e.target.value })} required />
              </label>
              <BranchLocationPicker
                isOpen={showNewModal}
                value={{ lat: draft.lat, lng: draft.lng, address: draft.address }}
                onChange={(next) =>
                  setDraft((prev) => ({ ...prev, lat: next.lat, lng: next.lng, address: next.address }))
                }
                mapsReady={mapsReady}
                mapsError={mapsError}
              />

              {/* <label>
                {t("openHours")}
                <input
                  value={draft.openHours || ""}
                  onChange={(e) => setDraft({ ...draft, openHours: e.target.value })}
                  placeholder="09:00 - 18:00"
                />
              </label> */}

              <div className="checkboxContainer">
                <input
                  id="branchActiveNew"
                  type="checkbox"
                  checked={Boolean(draft.isActive)}
                  onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                />
                <label htmlFor="branchActiveNew">{t("active")}</label>
              </div>
              {formError && <div className="error">{formError}</div>}
              <div className="modal-actions">
                <button className="ghost-btn" type="button" onClick={closeNewModal}>
                  {t("cancel")}
                </button>
                {canManage && (
                  <button className="primary" type="submit">
                    {t("save")}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {editingId && canManage && null}
    </>
  );
};

export default BranchesPage;
