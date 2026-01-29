import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Card from "../components/Card";
import api, { deleteCoupon, fetchCoupons, fetchProducts, saveCoupon } from "../api/client";
import type { ApiUser, Coupon, Product } from "../types/api";
import { useI18n } from "../context/I18nContext";
import { usePermissions } from "../hooks/usePermissions";

type CouponDraft = Omit<Coupon, "expiresAt" | "assignedUsers" | "assignedProducts" | "assignedMembershipLevels"> & {
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
  const [searchTerm, setSearchTerm] = useState("");
  const [enabledFilter, setEnabledFilter] = useState("");
  const [consumedFilter, setConsumedFilter] = useState("");
  const [expiresFrom, setExpiresFrom] = useState<Date | null>(null);
  const [expiresTo, setExpiresTo] = useState<Date | null>(null);
  const [draft, setDraft] = useState<CouponDraft>({});
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
  const [showEditProducts, setShowEditProducts] = useState(false);
  const [showEditLevels, setShowEditLevels] = useState(false);
  const [showEditAssigned, setShowEditAssigned] = useState(false);
  const { t } = useI18n();
  const { can } = usePermissions();
  const canManage = can("coupons:manage");

  const getFilterParams = () => ({
    q: searchTerm.trim() || undefined,
    enabled: enabledFilter ? enabledFilter === "true" : undefined,
    consumed: consumedFilter ? consumedFilter === "true" : undefined,
    expiresFrom: expiresFrom ? toIso(expiresFrom) : undefined,
    expiresTo: expiresTo ? toIso(expiresTo) : undefined,
  });

  const loadCoupons = (params?: { q?: string }) => {
    fetchCoupons(params).then(setCoupons).catch(console.error);
  };

  const loadUsers = () => {
    api.get<{ data: ApiUser[] }>("/users").then((res) => setUsers(res.data.data)).catch(() => setUsers([]));
  };
  const loadProducts = () => {
    fetchProducts({ includeUnavailable: true }).then(setProducts).catch(() => setProducts([]));
  };

  useEffect(() => {
    loadCoupons(getFilterParams());
    loadUsers();
    loadProducts();
  }, []);

  const openNewModal = () => {
    if (!canManage) return;
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
    } as CouponDraft);
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
    if (!canManage) return;
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
    }
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
    });
    setEditError("");
    setEditUserSearch("");
    setEditProductSearch("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!canManage) return;
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
      };
      const saved = await saveCoupon(payload);
      setCoupons((prev) => prev.map((c) => (c._id === saved._id ? saved : c)));
      setEditingId(null);
      setEditDraft({});
      loadCoupons(getFilterParams());
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Update failed";
      setEditError(msg);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({});
    setEditError("");
    setShowEditAssigned(false);
    setShowEditProducts(false);
    setShowEditLevels(false);
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

  return (
    <>

      <Card title={t("nav.coupons") || "Coupons"} subTitle={`(${coupons.length})`}>
        <div className="page-header">
          <div className="filters">
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
              onChange={(date) => setExpiresFrom(date)}
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
              onChange={(date) => setExpiresTo(date)}
              placeholderText={t("till") || "Till"}
              showTimeInput
              timeFormat="HH:mm"
              timeIntervals={15}
              dateFormat="yyyy-MM-dd HH:mm"
              isClearable
            />
            <button className="ghost-btn" type="button" onClick={applyFilters}>
              {t("filter")}
            </button>
          <button className="ghost-btn" type="button" onClick={resetFilters}>
            {t("clear")}
          </button>
        </div>
          <button className="primary" onClick={openNewModal} disabled={!canManage}>
            {t("addCoupon") || "Add coupon"}
          </button>
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
            {coupons.length === 0 ? (
              <tr>
                <td colSpan={12} className="muted">No coupons</td>
              </tr>
            ) : (
              coupons.map((coupon) => (
                <tr key={coupon._id} className="productRow">
                  <td>
                    {editingId === coupon._id ? (
                      <input value={editDraft.code || ""} onChange={(e) => setEditDraft({ ...editDraft, code: e.target.value })} />
                    ) : (
                      coupon.code
                    )}
                  </td>
                  <td>
                    {editingId === coupon._id ? (
                      <input value={editDraft.title || ""} onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })} />
                    ) : (
                      coupon.title || "-"
                    )}
                  </td>
                  <td>
                    {editingId === coupon._id ? (
                      <div className="flex">
                        <div className="radioRow">
                          <div className="radioOption">
                            <input
                              id={`editingisDiscount${coupon._id}`}
                              type="radio"
                              name={`couponType-${coupon._id}`}
                              checked={!editDraft.freeDelivery}
                              onChange={() =>
                                setEditDraft({
                                  ...editDraft,
                                  freeDelivery: false,
                                  discountValue: editDraft.discountValue || 10,
                                })
                              }
                            />
                            <label htmlFor={`editingisDiscount${coupon._id}`}>{t("discountCoupon") || "Discount coupon"}</label>
                          </div>
                          <div className="radioOption">
                            <input
                              id={`editingisFreeDelivery${coupon._id}`}
                              type="radio"
                              name={`couponType-${coupon._id}`}
                              checked={Boolean(editDraft.freeDelivery)}
                              onChange={() =>
                                setEditDraft({
                                  ...editDraft,
                                  freeDelivery: true,
                                  discountValue: 0,
                                })
                              }
                            />
                            <label htmlFor={`editingisFreeDelivery${coupon._id}`}>{t("freeDelivery") || "Free delivery"}</label>
                          </div>
                        </div>
                        {!editDraft.freeDelivery && (
                          <div className="flex align-center">
                            <select
                              value={editDraft.discountType || "PERCENT"}
                              onChange={(e) => setEditDraft({ ...editDraft, discountType: e.target.value as any })}
                            >
                              <option value="PERCENT">{t("percent") || "Percent"}</option>
                              <option value="FIXED">{t("fixed") || "Fixed"}</option>
                            </select>
                            <input
                              type="number"
                              value={editDraft.discountValue ?? 0}
                              onChange={(e) => setEditDraft({ ...editDraft, discountValue: Number(e.target.value) })}
                            />
                          </div>
                        )}
                      </div>
                    ) : coupon.freeDelivery ? (
                      t("freeDelivery") || "Free delivery"
                    ) : coupon.discountType === "PERCENT" ? (
                      `${coupon.discountValue}%`
                    ) : (
                      `${coupon.discountValue.toLocaleString()} SYP`
                    )}
                  </td>
                  <td>
                    {editingId === coupon._id ? (
                      <div className="flex">
                        <select
                          value={editDraft.usageType || "SINGLE"}
                          onChange={(e) => setEditDraft({ ...editDraft, usageType: e.target.value as any })}
                        >
                          <option value="SINGLE">{t("singleUse") || "Single"}</option>
                          <option value="MULTIPLE">{t("multiUse") || "Multiple"}</option>
                        </select>
                        {editDraft.usageType === "MULTIPLE" && (
                          <>
                            <input
                              type="number"
                              placeholder={t("maxUsesPerUser") || "Max per user"}
                              value={editDraft.maxUsesPerUser ?? ""}
                              onChange={(e) =>
                                setEditDraft({ ...editDraft, maxUsesPerUser: e.target.value ? Number(e.target.value) : undefined })
                              }
                            />
                            <input
                              type="number"
                              placeholder={t("maxUsesGlobal") || "Max global"}
                              value={editDraft.maxUsesGlobal ?? ""}
                              onChange={(e) =>
                                setEditDraft({ ...editDraft, maxUsesGlobal: e.target.value ? Number(e.target.value) : undefined })
                              }
                            />
                          </>
                        )}
                      </div>
                    ) : (
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
                    {editingId === coupon._id ? (
                      <DatePicker
                        className="filter-input date-picker"
                        selected={toDate(editDraft.expiresAt)}
                        onChange={(date) => setEditDraft({ ...editDraft, expiresAt: date || undefined })}
                        showTimeInput
                        timeFormat="HH:mm"
                        timeIntervals={15}
                        dateFormat="yyyy-MM-dd HH:mm"
                        isClearable
                      />
                    ) : coupon.expiresAt ? (
                      new Date(coupon.expiresAt).toLocaleString()
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    {editingId === coupon._id ? (
                      <div className="flex align-center">
                        <select
                          value={editDraft.assignmentType || "RESTRICTED"}
                          onChange={(e) =>
                            setEditDraft({
                              ...editDraft,
                              assignmentType: e.target.value as CouponDraft["assignmentType"],
                              assignedUsers: e.target.value === "USERS" ? editDraft.assignedUsers : [],
                              assignedProducts: e.target.value === "PRODUCTS" ? editDraft.assignedProducts : [],
                              assignedMembershipLevels: e.target.value === "LEVELS" ? editDraft.assignedMembershipLevels : [],
                              restricted: e.target.value === "RESTRICTED",
                            })
                          }
                        >
                          <option value="RESTRICTED">{t("assignmentRestricted") || "Restricted"}</option>
                          <option value="USERS">{t("assignmentUsers") || "Users"}</option>
                          <option value="PRODUCTS">{t("assignmentProducts") || "Products"}</option>
                          <option value="LEVELS">{t("assignmentLevels") || "Levels"}</option>
                        </select>
                        {editDraft.assignmentType === "USERS" && (
                          <>
                            <span>{getAssignedLabel(editDraft.assignedUsers)}</span>
                            <button className="ghost-btn" type="button" onClick={() => setShowEditAssigned(true)}>
                              {t("changeAssigned") || "Change assigned"}
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      coupon.assignedUsers && coupon.assignedUsers.length > 0
                        ? getAssignedLabel(coupon.assignedUsers)
                        : "-"
                    )}
                  </td>
                  <td>
                    {editingId === coupon._id ? (
                      editDraft.assignmentType === "PRODUCTS" ? (
                        <div className="flex align-center">
                          <span>{(editDraft.assignedProducts || []).length || 0}</span>
                          <button className="ghost-btn" type="button" onClick={() => setShowEditProducts(true)}>
                            {t("changeProducts") || "Change products"}
                          </button>
                        </div>
                      ) : (
                        "-"
                      )
                    ) : (
                      coupon.assignedProducts && coupon.assignedProducts.length > 0
                        ? (coupon.assignedProducts || []).length
                        : "-"
                    )}
                  </td>
                  <td>
                    {editingId === coupon._id ? (
                      editDraft.assignmentType === "LEVELS" ? (
                        <div className="flex align-center">
                          <span>{(editDraft.assignedMembershipLevels || []).length || 0}</span>
                          <button className="ghost-btn" type="button" onClick={() => setShowEditLevels(true)}>
                            {t("changeLevels") || "Change levels"}
                          </button>
                        </div>
                      ) : (
                        "-"
                      )
                    ) : (
                      coupon.assignedMembershipLevels && coupon.assignedMembershipLevels.length > 0
                        ? (coupon.assignedMembershipLevels || []).length
                        : "-"
                    )}
                  </td>
                  <td>
                    {editingId === coupon._id ? (
                      <div className="checkboxContainer">
                        <input
                          id={`couponRestricted${coupon._id}`}
                          type="checkbox"
                          checked={Boolean(editDraft.restricted)}
                          onChange={(e) => setEditDraft({ ...editDraft, restricted: e.target.checked })}
                        />
                        <label htmlFor={`couponRestricted${coupon._id}`}></label>
                      </div>
                    ) : (
                      coupon.restricted ? (t("yes") || "Yes") : (t("no") || "No")
                    )}
                  </td>
                  <td>
                    {editingId === coupon._id ? (
                      <div className="checkboxContainer">
                        <input
                          id={`couponIsEnabled${coupon._id}`}
                          type="checkbox"
                          checked={Boolean(editDraft.isActive)}
                          onChange={(e) => setEditDraft({ ...editDraft, isActive: e.target.checked })}
                        />
                        <label htmlFor={`couponIsEnabled${coupon._id}`}></label>
                      </div>

                    ) : (
                      coupon.isActive ? (t("yes") || "Yes") : (t("no") || "No")
                    )}
                  </td>
                  <td>
                    {editingId === coupon._id ? (
                      <div className="flex">
                        <button className="ghost-btn" onClick={saveEdit}>
                          {t("save")}
                        </button>
                        <button className="ghost-btn" onClick={cancelEdit}>
                          {t("cancel")}
                        </button>
                        <button className="ghost-btn danger" onClick={() => deleteCoupon(coupon._id).then(() => loadCoupons(getFilterParams()))}>
                          {t("delete")}
                        </button>
                        {editError && <div className="error">{editError}</div>}
                      </div>
                    ) : canManage ? (
                      <div className="flex">
                        <button className="ghost-btn" onClick={() => startEdit(coupon)}>
                          {t("edit")}
                        </button>
                        <button className="ghost-btn danger" onClick={() => deleteCoupon(coupon._id).then(() => loadCoupons(getFilterParams()))}>
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

      {showEditAssigned && editingId && canManage && (
        <div className="modal-backdrop" onClick={() => {
          setShowEditAssigned(false);
          setEditUserSearch("");
        }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t("changeAssigned") || "Change assigned"}</div>
              <button
                className="ghost-btn"
                type="button"
                onClick={() => {
                  setShowEditAssigned(false);
                  setEditUserSearch("");
                }}
              >
                {t("close")}
              </button>
            </div>
            {renderUserSelect(
              editDraft.assignedUsers,
              (ids) => setEditDraft({ ...editDraft, assignedUsers: ids }),
              editUserSearch,
              setEditUserSearch
            )}
          </div>
        </div>
      )}

      {showEditProducts && editingId && canManage && (
        <div className="modal-backdrop" onClick={() => {
          setShowEditProducts(false);
          setEditProductSearch("");
        }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t("changeProducts") || "Change products"}</div>
              <button
                className="ghost-btn"
                type="button"
                onClick={() => {
                  setShowEditProducts(false);
                  setEditProductSearch("");
                }}
              >
                {t("close")}
              </button>
            </div>
            {renderProductSelect(
              editDraft.assignedProducts,
              (ids) => setEditDraft({ ...editDraft, assignedProducts: ids }),
              editProductSearch,
              setEditProductSearch
            )}
          </div>
        </div>
      )}

      {showEditLevels && editingId && canManage && (
        <div className="modal-backdrop" onClick={() => setShowEditLevels(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t("changeLevels") || "Change levels"}</div>
              <button
                className="ghost-btn"
                type="button"
                onClick={() => setShowEditLevels(false)}
              >
                {t("close")}
              </button>
            </div>
            {renderLevelSelect(
              editDraft.assignedMembershipLevels,
              (ids) => setEditDraft({ ...editDraft, assignedMembershipLevels: ids }),
              editLevelSearch,
              setEditLevelSearch
            )}
          </div>
        </div>
      )}

      {showNewModal && canManage && (
        <div className="modal-backdrop" onClick={closeNewModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t("newCoupon") || "New Coupon"}</div>
              <button className="ghost-btn" type="button" onClick={closeNewModal}>
                {t("close")}
              </button>
            </div>
            <form className="form productRow" onSubmit={submit}>
              <label>
                {t("code") || "Code"}
                <input value={draft.code || ""} onChange={(e) => setDraft({ ...draft, code: e.target.value })} required />
              </label>

              <label>
                {t("title") || "Title"}
                <input value={draft.title || ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </label>

              <label>
                {t("description")}
                <input value={draft.description || ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </label>

              <div className="flex align-center">
                <div className="radioRow" style={{ flex: 1 }}>
                  <div className="radioOption">
                    <input
                      id="newCouponIsDiscount"
                      type="radio"
                      name="couponType"
                      checked={!draft.freeDelivery}
                      onChange={() =>
                        setDraft({
                          ...draft,
                          freeDelivery: false,
                          discountValue: draft.discountValue || 10,
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
                      checked={Boolean(draft.freeDelivery)}
                      onChange={() =>
                        setDraft({
                          ...draft,
                          freeDelivery: true,
                          discountValue: 0,
                        })
                      }
                    />
                    <label htmlFor="newCouponIsFreeDelivery">{t("freeDelivery") || "Free delivery"}</label>
                  </div>
                </div>

                <label style={{ flex: 1, marginBottom: 0, opacity: !draft.freeDelivery ? 1 : 0 }}>
                  {t("discount") || "Discount"}
                  <div className="flex">
                    <select
                      value={draft.discountType || "PERCENT"}
                      onChange={(e) => setDraft({ ...draft, discountType: e.target.value as any })}
                    >
                      <option value="PERCENT">{t("percent") || "Percent"}</option>
                      <option value="FIXED">{t("fixed") || "Fixed"}</option>
                    </select>
                    <input
                      className="fullWidthInput"
                      type="number"
                      value={draft.discountValue ?? 0}
                      onChange={(e) => setDraft({ ...draft, discountValue: Number(e.target.value) })}
                    />
                  </div>
                </label>

              </div>

              <div className="flex align-center">
                <label style={{ marginBottom: 0, flex: 1 }}>
                  {t("usage") || "Usage"}
                  <select
                    value={draft.usageType || "SINGLE"}
                    onChange={(e) => setDraft({ ...draft, usageType: e.target.value as any })}
                  >
                    <option value="SINGLE">{t("singleUse") || "Single"}</option>
                    <option value="MULTIPLE">{t("multiUse") || "Multiple"}</option>
                  </select>
                </label>

                {draft.usageType === "MULTIPLE" && (
                  <>
                    <label style={{ flex: 1, marginBottom: 0 }}>
                      {t("maxUsesPerUser") || "Max per user"}
                      <input
                        type="number"
                        value={draft.maxUsesPerUser ?? ""}
                        onChange={(e) => setDraft({ ...draft, maxUsesPerUser: e.target.value ? Number(e.target.value) : undefined })}
                      />
                    </label>
                    <label style={{ flex: 1, marginBottom: 0 }}>
                      {t("maxUsesGlobal") || "Max global"}
                      <input
                        type="number"
                        value={draft.maxUsesGlobal ?? ""}
                        onChange={(e) => setDraft({ ...draft, maxUsesGlobal: e.target.value ? Number(e.target.value) : undefined })}
                      />
                    </label>
                  </>
                )}
              </div>

              <label>
                {t("assignmentType") || "Assignment"}
                <div className="tab-row">
                  {(() => {
                    const currentType = draft.assignmentType || "RESTRICTED";
                    return (["RESTRICTED", "USERS", "PRODUCTS", "LEVELS"] as const).map((type) => (
                      <button
                        key={type}
                        className={`tab-btn ${currentType === type ? "active" : ""}`}
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            assignmentType: type,
                            assignedUsers: type === "USERS" ? draft.assignedUsers : [],
                            assignedProducts: type === "PRODUCTS" ? draft.assignedProducts : [],
                            assignedMembershipLevels: type === "LEVELS" ? draft.assignedMembershipLevels : [],
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
              {(draft.assignmentType || "RESTRICTED") === "USERS" && (
                <label>
                  {t("assignmentUsers") || "Users"}
                  {renderUserSelect(draft.assignedUsers, (ids) => setDraft({ ...draft, assignedUsers: ids }), userSearch, setUserSearch)}
                </label>
              )}
              {(draft.assignmentType || "RESTRICTED") === "PRODUCTS" && (
                <label>
                  {t("assignedProducts") || "Products"}
                  {renderProductSelect(draft.assignedProducts, (ids) => setDraft({ ...draft, assignedProducts: ids }), productSearch, setProductSearch)}
                </label>
              )}
              {(draft.assignmentType || "RESTRICTED") === "LEVELS" && (
                <label>
                  {t("assignedLevels") || "Membership levels"}
                  {renderLevelSelect(draft.assignedMembershipLevels, (ids) => setDraft({ ...draft, assignedMembershipLevels: ids }), levelSearch, setLevelSearch)}
                </label>
              )}

              <label>
                {t("expires") || "Expires"}
                <DatePicker
                  className="filter-input date-picker"
                  selected={toDate(draft.expiresAt)}
                  onChange={(date) => setDraft({ ...draft, expiresAt: date || undefined })}
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
                  checked={Boolean(draft.isActive)}
                  onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                />
                <label htmlFor="isEnabled">
                  {t("enabled") || "Enabled"}
                </label>
              </div>
              {/* <div className="checkboxContainer">
                <input
                  id="isRestricted"
                  type="checkbox"
                  checked={Boolean(draft.restricted)}
                  onChange={(e) => setDraft({ ...draft, restricted: e.target.checked })}
                />
                <label htmlFor="isRestricted">
                  {t("restricted") || "Restricted"}
                </label>
              </div> */}

              {formError && <div className="error">{formError}</div>}
              <div className="modal-actions">
                <button className="ghost-btn" type="button" onClick={closeNewModal}>
                  {t("cancel")}
                </button>
                <button className="primary" type="submit" disabled={!canManage}>
                  {t("save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default CouponsPage;
