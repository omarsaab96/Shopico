import ModalSurface from "../components/ModalSurface";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Card from "../components/Card";
import api, { deleteCoupon, fetchAllProducts, fetchCoupons, fetchCurrencies, saveCoupon } from "../api/client";
import type { ApiUser, Coupon, Currency, Product } from "../types/api";
import { useI18n } from "../context/I18nContext";
import { usePermissions } from "../hooks/usePermissions";
import { useBranch } from "../context/BranchContext";
import { confirmDelete } from "../utils/confirm";

type CouponDraft = Partial<Omit<Coupon, "expiresAt" | "assignedUsers" | "assignedProducts" | "assignedMembershipLevels">> & {
  expiresAt?: Date | string;
  assignedUsers?: string[];
  assignedProducts?: string[];
  assignedMembershipLevels?: string[];
  assignmentType?: "RESTRICTED" | "USERS" | "PRODUCTS" | "LEVELS";
};

const toIso = (value?: Date | string | null) => {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
};

const toDate = (value?: Date | string) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const getAssignedLabel = (users?: ApiUser[] | string[] | null) => {
  if (!users || users.length === 0) return "Nobody";
  const labels = users.map((user) => {
    if (typeof user === "string") return user;
    return user.name || user.email;
  });
  if (labels.length == 1) return "1 user";
  // return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
  return labels.length + " users";
};

const toggleUser = (list: string[] = [], id: string) => {
  if (list.includes(id)) return list.filter((item) => item !== id);
  return [...list, id];
};

const CouponsPage = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [enabledFilter, setEnabledFilter] = useState("");
  const [consumedFilter, setConsumedFilter] = useState("");
  const [expiresFrom, setExpiresFrom] = useState<Date | null>(null);
  const [expiresTo, setExpiresTo] = useState<Date | null>(null);
  const [draft, setDraft] = useState<CouponDraft>({});
  const [saving, setSaving] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<CouponDraft>({});
  const [formError, setFormError] = useState("");
  const [editError, setEditError] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [editUserSearch, setEditUserSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [editProductSearch, setEditProductSearch] = useState("");
  const [levelSearch, setLevelSearch] = useState("");
  const [editLevelSearch, setEditLevelSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();
  const { can } = usePermissions();
  const { selectedBranchId } = useBranch();
  const canManage = can("coupons:manage");

  const getCurrencyId = (currency?: Currency | string) => (typeof currency === "string" ? currency : currency?._id || "");
  const getCurrencySymbol = (currency?: Currency | string) => {
    const id = getCurrencyId(currency);
    const resolved = id ? currencies.find((item) => item._id === id) : typeof currency === "string" ? undefined : currency;
    return resolved?.symbol?.en || resolved?.symbol?.ar || t("syp").toUpperCase();
  };
  const primaryCurrencyId = currencies.find((currency) => currency.isPrimary)?._id || currencies[0]?._id || "";

  const getFilterParams = () => ({
    q: searchTerm.trim() || undefined,
    enabled: enabledFilter ? enabledFilter === "true" : undefined,
    consumed: consumedFilter ? consumedFilter === "true" : undefined,
    expiresFrom: expiresFrom ? toIso(expiresFrom) : undefined,
    expiresTo: expiresTo ? toIso(expiresTo) : undefined,
  });

  const loadCoupons = async (params?: { q?: string }) => {
    setLoading(true);
    try {
      const data = await fetchCoupons(params);
      setCoupons(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = () => {
    api.get<{ data: ApiUser[] }>("/users").then((res) => setUsers(res.data.data)).catch(() => setUsers([]));
  };
  const loadProducts = () => {
    fetchAllProducts({ includeUnavailable: true }).then(setProducts).catch(() => setProducts([]));
  };
  const loadCurrencies = () => {
    fetchCurrencies().then((data) => setCurrencies(data.filter((currency) => currency.isActive))).catch(() => setCurrencies([]));
  };

  useEffect(() => {
    if (!selectedBranchId) return;
    loadCoupons(getFilterParams());
    loadUsers();
    loadProducts();
    loadCurrencies();
  }, [selectedBranchId]);

  const openNewModal = () => {
    if (!canManage || saving) return;
    cancelEdit();
    setDraft({
      usageType: "SINGLE",
      maxUsesPerUser: undefined,
      maxUsesGlobal: undefined,
      discountType: "PERCENT",
      discountValue: 10,
      freeDelivery: false,
      isActive: true,
      restricted: true,
      assignedUsers: [],
      assignedProducts: [],
      assignedMembershipLevels: [],
      assignmentType: "RESTRICTED",
      currencyId: primaryCurrencyId,
    });
    setFormError("");
    setUserSearch("");
    setProductSearch("");
    setLevelSearch("");
    setShowNewModal(true);
  };

  const closeNewModal = () => {
    setShowNewModal(false);
    setUserSearch("");
    setProductSearch("");
    setLevelSearch("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!canManage) return;
    setSaving(true);
    try {
      const { assignmentType, ...rest } = draft;
      const restricted = assignmentType === "RESTRICTED";
      const payload = {
        ...rest,
        code: draft.code?.toUpperCase(),
        expiresAt: toIso(draft.expiresAt),
        assignedUsers: assignmentType === "USERS" ? (draft.assignedUsers || []) : [],
        assignedProducts: assignmentType === "PRODUCTS" ? (draft.assignedProducts || []) : [],
        assignedMembershipLevels: assignmentType === "LEVELS" ? (draft.assignedMembershipLevels || []) : [],
        restricted,
        maxUsesPerUser: draft.usageType === "MULTIPLE" ? draft.maxUsesPerUser : undefined,
        maxUsesGlobal: draft.usageType === "MULTIPLE" ? draft.maxUsesGlobal : undefined,
        discountValue: draft.freeDelivery ? 0 : draft.discountValue,
        currencyId: !draft.freeDelivery && draft.discountType === "FIXED" ? (draft.currencyId || primaryCurrencyId) : undefined,
      };
      const saved = await saveCoupon(payload);
      setCoupons((prev) => [saved, ...prev]);
      setDraft({});
      setFormError("");
      setShowNewModal(false);
      loadCoupons(getFilterParams());
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Create failed";
      setFormError(msg);
    } finally { setSaving(false); }
  };

  const startEdit = (coupon: Coupon) => {
    if (!canManage) return;
    const legacyScope = coupon.maxUsesScope || "PER_USER";
    const resolvedPerUser = coupon.maxUsesPerUser ?? (legacyScope === "PER_USER" ? coupon.maxUses : undefined);
    const resolvedGlobal = coupon.maxUsesGlobal ?? (legacyScope === "GLOBAL" ? coupon.maxUses : undefined);
    const assignmentType =
      coupon.assignedUsers && coupon.assignedUsers.length > 0
        ? "USERS"
        : coupon.assignedProducts && coupon.assignedProducts.length > 0
          ? "PRODUCTS"
          : coupon.assignedMembershipLevels && coupon.assignedMembershipLevels.length > 0
            ? "LEVELS"
            : "RESTRICTED";
    setShowNewModal(false);
    setEditingId(coupon._id);
    setEditDraft({
      ...coupon,
      assignmentType,
      assignedUsers: Array.isArray(coupon.assignedUsers)
        ? coupon.assignedUsers.map((u) => (typeof u === "string" ? u : u._id))
        : [],
      assignedProducts: Array.isArray(coupon.assignedProducts)
        ? coupon.assignedProducts.map((p) => (typeof p === "string" ? p : p._id))
        : [],
      assignedMembershipLevels: coupon.assignedMembershipLevels || [],
      maxUsesPerUser: resolvedPerUser,
      maxUsesGlobal: resolvedGlobal,
      currencyId: getCurrencyId(coupon.currency) || primaryCurrencyId,
    });
    setEditError("");
    setEditUserSearch("");
    setEditProductSearch("");
  };

  const saveEdit = async () => {
    if (saving) return;
    if (!editingId) return;
    if (!canManage) return;
    setSaving(true);
    try {
      const { assignmentType, ...rest } = editDraft;
      const restricted = assignmentType === "RESTRICTED";
      const payload = {
        ...rest,
        _id: editingId,
        code: editDraft.code?.toUpperCase(),
        expiresAt: toIso(editDraft.expiresAt),
        assignedUsers: assignmentType === "USERS" ? (editDraft.assignedUsers || []) : [],
        assignedProducts: assignmentType === "PRODUCTS" ? (editDraft.assignedProducts || []) : [],
        assignedMembershipLevels: assignmentType === "LEVELS" ? (editDraft.assignedMembershipLevels || []) : [],
        restricted,
        maxUsesPerUser: editDraft.usageType === "MULTIPLE" ? editDraft.maxUsesPerUser : undefined,
        maxUsesGlobal: editDraft.usageType === "MULTIPLE" ? editDraft.maxUsesGlobal : undefined,
        discountValue: editDraft.freeDelivery ? 0 : editDraft.discountValue,
        currencyId: !editDraft.freeDelivery && editDraft.discountType === "FIXED" ? (editDraft.currencyId || primaryCurrencyId) : undefined,
      };
      const saved = await saveCoupon(payload);
      setCoupons((prev) => prev.map((c) => (c._id === saved._id ? saved : c)));
      setEditingId(null);
      setEditDraft({});
      loadCoupons(getFilterParams());
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Update failed";
      setEditError(msg);
    } finally { setSaving(false); }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({});
    setEditError("");
    setEditUserSearch("");
    setEditProductSearch("");
    setEditLevelSearch("");
  };

  const applyFilters = () => loadCoupons(getFilterParams());

  const resetFilters = () => {
    setSearchTerm("");
    setEnabledFilter("");
    setConsumedFilter("");
    setExpiresFrom(null);
    setExpiresTo(null);
    loadCoupons();
  };

  const renderUserSelect = (
    selectedIds: string[] | undefined,
    setSelected: (ids: string[]) => void,
    search: string,
    setSearch: (value: string) => void
  ) => {
    const list = selectedIds || [];
    const filtered = users.filter((u) => {
      const term = search.trim().toLowerCase();
      if (!term) return true;
      return u.name?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term);
    });

    return (
      <div className="multi-select">
        <div className="flex">
          <div className="multiSelectSearch">
            <input
              className="filter-input"
              placeholder={t("searchUsers") || "Search users"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="clearSearchBtn" type="button" onClick={() => setSearch("")}>

              </button>
            )}
          </div>

          <div className="multi-select-actions">
            <button
              className="ghost-btn"
              type="button"
              onClick={() => {
                if (list.length === users.length) {
                  setSelected([]);
                } else {
                  setSelected(users.map((u) => u._id));
                }
              }}
            >
              {list.length === users.length ? (t("clearAll") || "Clear all") : (t("selectAll") || "Select all")}
            </button>
            {list.length > 0 && (
              <div className="multi-select-count">
                {t("selected") || "Selected"}: {list.length}
              </div>
            )}
          </div>
        </div>

        <div className="multi-select-list">
          {filtered.length === 0 ? (
            <div className="muted">{t("noResults") || "No results"}</div>
          ) : (
            filtered.map((u) => {
              const checked = list.includes(u._id);
              return (
                <div key={u._id} className="checkboxContainer multi-select-item">
                  <input
                    id={`userSelect${u._id}`}
                    type="checkbox"
                    checked={checked}
                    onChange={() => setSelected(toggleUser(list, u._id))}
                  />
                  <label htmlFor={`userSelect${u._id}`}>
                    {u.name} ({u.email})
                  </label>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderProductSelect = (
    selectedIds: string[] | undefined,
    setSelected: (ids: string[]) => void,
    search: string,
    setSearch: (value: string) => void
  ) => {
    const list = selectedIds || [];
    const filtered = products.filter((p) => {
      const term = search.trim().toLowerCase();
      if (!term) return true;
      return p.name?.toLowerCase().includes(term) || p.description?.toLowerCase().includes(term);
    });

    return (
      <div className="multi-select">
        <div className="flex">
          <div className="multiSelectSearch">
            <input
              className="filter-input"
              placeholder={t("searchProducts") || "Search products"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="clearSearchBtn" type="button" onClick={() => setSearch("")}>

              </button>
            )}
          </div>

          <div className="multi-select-actions">
            <button
              className="ghost-btn"
              type="button"
              onClick={() => {
                if (list.length === products.length) {
                  setSelected([]);
                } else {
                  setSelected(products.map((p) => p._id));
                }
              }}
            >
              {list.length === products.length ? (t("clearAll") || "Clear all") : (t("selectAll") || "Select all")}
            </button>
            {list.length > 0 && (
              <div className="multi-select-count">
                {t("selected") || "Selected"}: {list.length}
              </div>
            )}
          </div>
        </div>

        <div className="multi-select-list">
          {filtered.length === 0 ? (
            <div className="muted">{t("noResults") || "No results"}</div>
          ) : (
            filtered.map((p) => {
              const checked = list.includes(p._id);
              return (
                <div key={p._id} className="checkboxContainer multi-select-item">
                  <input
                    id={`productSelect${p._id}`}
                    type="checkbox"
                    checked={checked}
                    onChange={() => setSelected(toggleUser(list, p._id))}
                  />
                  <label htmlFor={`productSelect${p._id}`}>
                    {p.name}
                  </label>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const membershipLevels = [
    { value: "None", label: t("standard") || "Standard" },
    { value: "Silver", label: t("level.silver") || "Silver" },
    { value: "Gold", label: t("level.gold") || "Gold" },
    { value: "Platinum", label: t("level.platinum") || "Platinum" },
    { value: "Diamond", label: t("level.diamond") || "Diamond" },
  ];

  const renderLevelSelect = (
    selectedIds: string[] | undefined,
    setSelected: (ids: string[]) => void,
    search: string,
    setSearch: (value: string) => void
  ) => {
    const list = selectedIds || [];
    const filtered = membershipLevels.filter((level) => {
      const term = search.trim().toLowerCase();
      if (!term) return true;
      return level.label.toLowerCase().includes(term) || level.value.toLowerCase().includes(term);
    });
    return (
      <div className="multi-select">
        <div className="flex">
          <div className="multiSelectSearch">
            <input
              className="filter-input"
              placeholder={t("searchLevels") || "Search levels"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="clearSearchBtn" type="button" onClick={() => setSearch("")}>

              </button>
            )}
          </div>
          <div className="multi-select-actions">
          <button
            className="ghost-btn"
            type="button"
            onClick={() => {
              if (list.length === membershipLevels.length) {
                setSelected([]);
              } else {
                setSelected(membershipLevels.map((l) => l.value));
              }
            }}
          >
            {list.length === membershipLevels.length ? (t("clearAll") || "Clear all") : (t("selectAll") || "Select all")}
          </button>
          {list.length > 0 && (
            <div className="multi-select-count">
              {t("selected") || "Selected"}: {list.length}
            </div>
          )}
        </div>
        </div>

        <div className="multi-select-list">
          {filtered.length === 0 ? (
            <div className="muted">{t("noResults") || "No results"}</div>
          ) : filtered.map((level) => {
            const checked = list.includes(level.value);
            return (
              <div key={level.value} className="checkboxContainer multi-select-item">
                <input
                  id={`levelSelect${level.value}`}
                  type="checkbox"
                  checked={checked}
                  onChange={() => setSelected(toggleUser(list, level.value))}
                />
                <label htmlFor={`levelSelect${level.value}`}>
                  {level.label}
                </label>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const modalDraft = editingId ? editDraft : draft;
  const setModalDraft = editingId ? setEditDraft : setDraft;
  const modalError = editingId ? editError : formError;
  const modalUserSearch = editingId ? editUserSearch : userSearch;
  const setModalUserSearch = editingId ? setEditUserSearch : setUserSearch;
  const modalProductSearch = editingId ? editProductSearch : productSearch;
  const setModalProductSearch = editingId ? setEditProductSearch : setProductSearch;
  const modalLevelSearch = editingId ? editLevelSearch : levelSearch;
  const setModalLevelSearch = editingId ? setEditLevelSearch : setLevelSearch;
  const closeEditor = () => { if (saving) return; cancelEdit(); closeNewModal(); };

  return (
    <>

      <Card title={t("nav.coupons") || "Coupons"} subTitle={`(${coupons.length})`}>
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
              placeholder={t("searchCoupons") || "Search code/title/description/user"}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select className="filter-select" value={enabledFilter} onChange={(e) => setEnabledFilter(e.target.value)}>
              <option value="">{t("enabled") || "Enabled"}</option>
              <option value="true">{t("yes") || "Yes"}</option>
              <option value="false">{t("no") || "No"}</option>
            </select>
            <select className="filter-select" value={consumedFilter} onChange={(e) => setConsumedFilter(e.target.value)}>
              <option value="">{t("consumed") || "Consumed"}</option>
              <option value="true">{t("yes") || "Yes"}</option>
              <option value="false">{t("no") || "No"}</option>
            </select>
            <DatePicker
              className="filter-input date-picker"
              selected={expiresFrom}
              onChange={(date: Date | null) => setExpiresFrom(date)}
              placeholderText={t("from") || "From"}
              showTimeInput
              timeFormat="HH:mm"
              timeIntervals={15}
              dateFormat="yyyy-MM-dd HH:mm"
              isClearable
            />
            <DatePicker
              className="filter-input date-picker"
              selected={expiresTo}
              onChange={(date: Date | null) => setExpiresTo(date)}
              placeholderText={t("till") || "Till"}
              showTimeInput
              timeFormat="HH:mm"
              timeIntervals={15}
              dateFormat="yyyy-MM-dd HH:mm"
              isClearable
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
              {t("addCoupon") || "Add coupon"}
            </button>
          )}
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>{t("code") || "Code"}</th>
              <th>{t("title") || "Title"}</th>
              <th>{t("discount") || "Discount"}</th>
              <th>{t("usage") || "Usage"}</th>
              <th>{t("used") || "Used"}</th>
              <th>{t("expires") || "Expires"}</th>
              <th>{t("assignedTo") || "Assigned to"}</th>
              <th>{t("assignedProducts") || "Products"}</th>
              <th>{t("assignedLevels") || "Levels"}</th>
              <th>{t("restricted") || "Restricted"}</th>
              <th>{t("enabled") || "Enabled"}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="productRow">
                  <td><span className="skeleton-line w-120" /></td>
                  <td><span className="skeleton-line w-180" /></td>
                  <td><span className="skeleton-line w-80" /></td>
                  <td><span className="skeleton-line w-80" /></td>
                  <td><span className="skeleton-line w-80" /></td>
                  <td><span className="skeleton-line w-120" /></td>
                  <td><span className="skeleton-line w-120" /></td>
                  <td><span className="skeleton-line w-120" /></td>
                  <td><span className="skeleton-line w-120" /></td>
                  <td><span className="skeleton-line w-80" /></td>
                  <td><span className="skeleton-line w-80" /></td>
                  <td><span className="skeleton-line w-120" /></td>
                </tr>
              ))
            ) : coupons.length === 0 ? (
              <tr>
                <td colSpan={12} className="muted">No coupons</td>
              </tr>
            ) : (
              coupons.map((coupon) => (
                <tr key={coupon._id} className="productRow">
                  <td>
                    {(
                      coupon.code
                    )}
                  </td>
                  <td>
                    {(
                      coupon.title || "-"
                    )}
                  </td>
                  <td>
                    {coupon.freeDelivery ? (
                      t("freeDelivery") || "Free delivery"
                    ) : coupon.discountType === "PERCENT" ? (
                      `${coupon.discountValue}%`
                    ) : (
                      `${coupon.discountValue.toLocaleString()} ${getCurrencySymbol(coupon.currency)}`
                    )}
                  </td>
                  <td>
                    {(
                      coupon.usageType === "SINGLE"
                        ? (t("singleUse") || "Single")
                        : (() => {
                          const legacyScope = coupon.maxUsesScope || "PER_USER";
                          const perUser = coupon.maxUsesPerUser ?? (legacyScope === "PER_USER" ? coupon.maxUses : undefined);
                          const global = coupon.maxUsesGlobal ?? (legacyScope === "GLOBAL" ? coupon.maxUses : undefined);
                          if (!perUser && !global) return t("multiUse") || "Multiple";
                          const parts = [];
                          if (perUser) parts.push(`${t("perUser") || "Per user"} ${perUser}`);
                          if (global) parts.push(`${t("global") || "Global"} ${global}`);
                          return `${t("multiUse") || "Multiple"} (${parts.join(" / ")})`;
                        })()
                    )}
                  </td>
                  <td>{coupon.usedCount ?? 0}</td>
                  <td>
                    {coupon.expiresAt ? (
                      new Date(coupon.expiresAt).toLocaleString()
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    {(
                      coupon.assignedUsers && coupon.assignedUsers.length > 0
                        ? getAssignedLabel(coupon.assignedUsers)
                        : "-"
                    )}
                  </td>
                  <td>
                    {(
                      coupon.assignedProducts && coupon.assignedProducts.length > 0
                        ? (coupon.assignedProducts || []).length
                        : "-"
                    )}
                  </td>
                  <td>
                    {(
                      coupon.assignedMembershipLevels && coupon.assignedMembershipLevels.length > 0
                        ? (coupon.assignedMembershipLevels || []).length
                        : "-"
                    )}
                  </td>
                  <td>
                    {(
                      coupon.restricted ? (t("yes") || "Yes") : (t("no") || "No")
                    )}
                  </td>
                  <td>
                    {(
                      coupon.isActive ? (t("yes") || "Yes") : (t("no") || "No")
                    )}
                  </td>
                  <td>
                    {canManage ? (
                      <div className="flex">
                        <button className="primary" onClick={() => startEdit(coupon)}>
                          {t("edit")}
                        </button>
                        <button className="ghost-btn danger" onClick={async () => (await confirmDelete(t)) && deleteCoupon(coupon._id).then(() => loadCoupons(getFilterParams()))}>
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
          <ModalSurface className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t(editingId ? "editCoupon" : "newCoupon") || "New Coupon"}</div>
              <button className="ghost-btn" type="button" onClick={closeEditor} disabled={saving}>
                {t("close")}
              </button>
            </div>
            <form className="form productRow" onSubmit={editingId ? event => { event.preventDefault(); void saveEdit(); } : submit}>
              <label>
                {t("code") || "Code"}
                <input autoFocus value={modalDraft.code || ""} onChange={(e) => setModalDraft({ ...modalDraft, code: e.target.value })} required />
              </label>

              <label>
                {t("title") || "Title"}
                <input value={modalDraft.title || ""} onChange={(e) => setModalDraft({ ...modalDraft, title: e.target.value })} />
              </label>

              <label>
                {t("description")}
                <input value={modalDraft.description || ""} onChange={(e) => setModalDraft({ ...modalDraft, description: e.target.value })} />
              </label>

              <div className="flex align-center">
                <div className="radioRow" style={{ flex: 1 }}>
                  <div className="radioOption">
                    <input
                      id="newCouponIsDiscount"
                      type="radio"
                      name="couponType"
                      checked={!modalDraft.freeDelivery}
                      onChange={() =>
                        setModalDraft({
                          ...modalDraft,
                          freeDelivery: false,
                          discountValue: modalDraft.discountValue || 10,
                        })
                      }
                    />
                    <label htmlFor="newCouponIsDiscount">{t("discountCoupon") || "Discount coupon"}</label>
                  </div>
                  <div className="radioOption">
                    <input
                      id="newCouponIsFreeDelivery"
                      type="radio"
                      name="couponType"
                      checked={Boolean(modalDraft.freeDelivery)}
                      onChange={() =>
                        setModalDraft({
                          ...modalDraft,
                          freeDelivery: true,
                          discountValue: 0,
                        })
                      }
                    />
                    <label htmlFor="newCouponIsFreeDelivery">{t("freeDelivery") || "Free delivery"}</label>
                  </div>
                </div>

                <label style={{ flex: 1, marginBottom: 0, opacity: !modalDraft.freeDelivery ? 1 : 0 }}>
                  {t("discount") || "Discount"}
                  <div className="flex">
                    <select
                      value={modalDraft.discountType || "PERCENT"}
                      onChange={(e) => setModalDraft({ ...modalDraft, discountType: e.target.value as any })}
                    >
                      <option value="PERCENT">{t("percent") || "Percent"}</option>
                      <option value="FIXED">{t("fixed") || "Fixed"}</option>
                    </select>
                    <input
                      className="fullWidthInput"
                      type="number"
                      value={modalDraft.discountValue ?? 0}
                      onChange={(e) => setModalDraft({ ...modalDraft, discountValue: Number(e.target.value) })}
                    />
                    {(modalDraft.discountType || "PERCENT") === "FIXED" && (
                      <select
                        value={modalDraft.currencyId || primaryCurrencyId}
                        onChange={(e) => setModalDraft({ ...modalDraft, currencyId: e.target.value })}
                      >
                        {currencies.map((currency) => (
                          <option key={currency._id} value={currency._id}>
                            {getCurrencySymbol(currency)}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </label>

              </div>

              <div className="flex align-center">
                <label style={{ marginBottom: 0, flex: 1 }}>
                  {t("usage") || "Usage"}
                  <select
                    value={modalDraft.usageType || "SINGLE"}
                    onChange={(e) => setModalDraft({ ...modalDraft, usageType: e.target.value as any })}
                  >
                    <option value="SINGLE">{t("singleUse") || "Single"}</option>
                    <option value="MULTIPLE">{t("multiUse") || "Multiple"}</option>
                  </select>
                </label>

                {modalDraft.usageType === "MULTIPLE" && (
                  <>
                    <label style={{ flex: 1, marginBottom: 0 }}>
                      {t("maxUsesPerUser") || "Max per user"}
                      <input
                        type="number"
                        value={modalDraft.maxUsesPerUser ?? ""}
                        onChange={(e) => setModalDraft({ ...modalDraft, maxUsesPerUser: e.target.value ? Number(e.target.value) : undefined })}
                      />
                    </label>
                    <label style={{ flex: 1, marginBottom: 0 }}>
                      {t("maxUsesGlobal") || "Max global"}
                      <input
                        type="number"
                        value={modalDraft.maxUsesGlobal ?? ""}
                        onChange={(e) => setModalDraft({ ...modalDraft, maxUsesGlobal: e.target.value ? Number(e.target.value) : undefined })}
                      />
                    </label>
                  </>
                )}
              </div>

              <label>
                {t("assignmentType") || "Assignment"}
                <div className="tab-row">
                  {(() => {
                    const currentType = modalDraft.assignmentType || "RESTRICTED";
                    return (["RESTRICTED", "USERS", "PRODUCTS", "LEVELS"] as const).map((type) => (
                      <button
                        key={type}
                        className={`tab-btn ${currentType === type ? "active" : ""}`}
                        type="button"
                        onClick={() =>
                          setModalDraft({
                            ...modalDraft,
                            assignmentType: type,
                            assignedUsers: type === "USERS" ? modalDraft.assignedUsers : [],
                            assignedProducts: type === "PRODUCTS" ? modalDraft.assignedProducts : [],
                            assignedMembershipLevels: type === "LEVELS" ? modalDraft.assignedMembershipLevels : [],
                            restricted: type === "RESTRICTED",
                          })
                        }
                      >
                        {type === "RESTRICTED"
                          ? (t("assignmentRestricted") || "Restricted")
                          : type === "USERS"
                            ? (t("assignmentUsers") || "Users")
                            : type === "PRODUCTS"
                              ? (t("assignmentProducts") || "Products")
                              : (t("assignmentLevels") || "Levels")}
                      </button>
                    ));
                  })()}
                </div>
              </label>
              {(modalDraft.assignmentType || "RESTRICTED") === "USERS" && (
                <label>
                  {t("assignmentUsers") || "Users"}
                  {renderUserSelect(modalDraft.assignedUsers, (ids) => setModalDraft({ ...modalDraft, assignedUsers: ids }), modalUserSearch, setModalUserSearch)}
                </label>
              )}
              {(modalDraft.assignmentType || "RESTRICTED") === "PRODUCTS" && (
                <label>
                  {t("assignedProducts") || "Products"}
                  {renderProductSelect(modalDraft.assignedProducts, (ids) => setModalDraft({ ...modalDraft, assignedProducts: ids }), modalProductSearch, setModalProductSearch)}
                </label>
              )}
              {(modalDraft.assignmentType || "RESTRICTED") === "LEVELS" && (
                <label>
                  {t("assignedLevels") || "Membership levels"}
                  {renderLevelSelect(modalDraft.assignedMembershipLevels, (ids) => setModalDraft({ ...modalDraft, assignedMembershipLevels: ids }), modalLevelSearch, setModalLevelSearch)}
                </label>
              )}

              <label>
                {t("expires") || "Expires"}
                <DatePicker
                  className="filter-input date-picker"
                  selected={toDate(modalDraft.expiresAt)}
                  onChange={(date: Date | null) => setModalDraft({ ...modalDraft, expiresAt: date || undefined })}
                  showTimeInput
                  timeFormat="HH:mm"
                  timeIntervals={15}
                  dateFormat="yyyy-MM-dd HH:mm"
                  isClearable
                />
              </label>

              <div className="checkboxContainer">
                <input
                  id="isEnabled"
                  type="checkbox"
                  checked={Boolean(modalDraft.isActive)}
                  onChange={(e) => setModalDraft({ ...modalDraft, isActive: e.target.checked })}
                />
                <label htmlFor="isEnabled">
                  {t("enabled") || "Enabled"}
                </label>
              </div>
              {/* <div className="checkboxContainer">
                <input
                  id="isRestricted"
                  type="checkbox"
                  checked={Boolean(modalDraft.restricted)}
                  onChange={(e) => setModalDraft({ ...modalDraft, restricted: e.target.checked })}
                />
                <label htmlFor="isRestricted">
                  {t("restricted") || "Restricted"}
                </label>
              </div> */}

              {modalError && <div className="error" role="alert">{modalError}</div>}
              
            </form>
            <div className="modal-actions">
                <button className="ghost-btn" type="button" onClick={closeEditor} disabled={saving}>
                  {t("cancel")}
                </button>
                {canManage && (
                  <button className="primary" type="submit" disabled={saving}>
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

export default CouponsPage;
