import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, pointerWithin, rectIntersection, useSensor, useSensors } from "@dnd-kit/core";
import { OrderDragCard, OrderDropBasket } from "../components/OrderBasketDrag";
import OrderDetailsModal from "../components/OrderDetailsModal";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Card from "../components/Card";
import StatusPill from "../components/StatusPill";
import api, { fetchCurrencies, fetchDrivers, fetchOrders, updateOrderDetails, updateOrderStatus } from "../api/client";
import type { ApiUser, Currency, Order } from "../types/api";
import { useI18n } from "../context/I18nContext";
import { usePermissions } from "../hooks/usePermissions";
import { useBranch } from "../context/BranchContext";

const statuses = ["PENDING", "PROCESSING", "SHIPPING", "DELIVERED", "CANCELLED"];
const USER_ABOUT_VIEW_PERMISSIONS = ["users:about:view"] as const;
const USER_BRANCHES_VIEW_PERMISSIONS = ["users:branches:view"] as const;

const orderDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const objectIdPattern = /^[a-f\d]{24}$/i;

interface UserDetails {
  user: ApiUser;
  wallet?: { balance: number };
  walletTx: { amount: number; type: string; source: string; createdAt: string }[];
  pointTx: { points: number; type: string; createdAt: string }[];
  addresses: { _id: string; label: string; address: string; phone?: string }[];
}

type EditPickerType = "status" | "driver" | null;

const toIso = (value?: Date | null) => {
  if (!value) return undefined;
  if (Number.isNaN(value.getTime())) return undefined;
  return value.toISOString();
};

const OrdersPage = () => {
  const [view, setView] = useState<"table" | "basket">(() => localStorage.getItem("orders-view") === "table" ? "table" : "basket");
  const [draggedOrder, setDraggedOrder] = useState<Order | null>(null);
  const [dragStatus, setDragStatus] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 7 } }), useSensor(KeyboardSensor));
  const [boardUpdatingId, setBoardUpdatingId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState("");
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [drivers, setDrivers] = useState<ApiUser[]>([]);
  const [assigning, setAssigning] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ status: string; driverId: string; paymentStatus: string } | null>(null);
  const [activeEditPicker, setActiveEditPicker] = useState<EditPickerType>(null);
  const [userDetailsLoading, setUserDetailsLoading] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
  const mutatingRef = useRef(false);
  const { t, tStatus, lang } = useI18n();
  const { can, canAny } = usePermissions();
  const { selectedBranchId } = useBranch();
  const [detailsOrderId, setDetailsOrderId] = useState<string | null>(null);
  const canViewOrders = can("orders:view");
  const canUpdateOrders = canViewOrders && can("orders:update");
  const canViewUsersPage = can("users:view");
  const canViewUserAbout = canAny(...USER_ABOUT_VIEW_PERMISSIONS);
  const canViewUserLedger = can("users:ledger:view");
  const canViewUserBranches = canAny(...USER_BRANCHES_VIEW_PERMISSIONS);
  const canOpenUserDetails =
    canViewUsersPage && (canViewUserAbout || canViewUserLedger || canViewUserBranches);

  const formatOrderDateTime = (value?: string) => {
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "—";
    return orderDateTimeFormatter.format(parsed);
  };

  const getOrderUserId = (order: Order) => {
    const candidate = typeof order.user === "string" ? order.user : order.user?._id;
    return candidate && objectIdPattern.test(candidate) ? candidate : "";
  };

  const getOrderUserLabel = (order: Order) => (typeof order.user === "string" ? order.user : order.user.email);
  const resolveCurrency = (currency?: Currency | string) => {
    const currencyId = typeof currency === "string" ? currency : currency?._id;
    const fromList = currencyId ? currencies.find((item) => item._id === currencyId) : undefined;
    return fromList || (typeof currency === "string" ? undefined : currency);
  };
  const getCurrencySymbol = (currency?: Currency | string) => {
    const resolved = resolveCurrency(currency);
    if (!resolved) return t("syp").toUpperCase();
    const localized = resolved.symbol?.[lang] || resolved.symbol?.en || resolved.symbol?.ar || "";
    if (lang === "ar" && localized.toLowerCase?.() === resolved.symbol?.en?.toLowerCase?.()) {
      const translated = t(`currencySymbol.${resolved.symbol.en.toUpperCase()}`);
      if (translated !== `currencySymbol.${resolved.symbol.en.toUpperCase()}`) return translated;
    }
    return localized;
  };
  const formatOrderMoney = (value: number, currency?: Currency | string) => {
    const resolved = resolveCurrency(currency);
    if (!resolved) return `${value.toLocaleString()} ${t("syp").toUpperCase()}`;
    const rate = Number(resolved.exchangeRate || 1);
    const converted = resolved.isPrimary ? value : value / (rate > 0 ? rate : 1);
    return `${converted.toLocaleString(undefined, { maximumFractionDigits: resolved.isPrimary ? 0 : 2 })} ${getCurrencySymbol(resolved)}`;
  };

  const getDriverIdValue = (driverId?: ApiUser | string | null) =>
    typeof driverId === "string" ? driverId : driverId?._id || "";

  const getDriver = (driverId?: ApiUser | string | null) => {
    const driverIdValue = getDriverIdValue(driverId);
    if (!driverIdValue) return null;
    if (typeof driverId !== "string") return driverId;
    return drivers.find((item) => item._id === driverIdValue) || null;
  };

  const getDriverLabel = (driverId?: ApiUser | string | null) => {
    if (!driverId) return "—";
    const driver = getDriver(driverId);
    return driver ? `${driver.name}` : "—";
  };

  const getDriverStatusLabel = (driver?: ApiUser | null) => {
    if (!driver) return t("driverStatus.available");
    return driver.driverStatus === "BUSY" ? t("driverStatus.busy") : t("driverStatus.available");
  };

  const getDriverStatusClassName = (driver?: ApiUser | null) =>
    driver?.driverStatus === "BUSY" ? "driver-picker-status busy" : "driver-picker-status available";

  const selectedUserRecentOrders = selectedUser
    ? orders.filter((order) => getOrderUserId(order) === selectedUser.user._id).slice(0, 5)
    : [];

  const loadUserDetails = async (userId: string) => {
    if (!canOpenUserDetails) return;
    setUserDetailsLoading(userId);
    try {
      const res = await api.get<{ data: UserDetails }>(`/users/${userId}`);
      setSelectedUser(res.data.data);
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || "Failed to load user details";
      console.error("User details load failed:", message);
      window.alert(message);
    } finally {
      setUserDetailsLoading("");
    }
  };

  const closeUserDetails = () => {
    setSelectedUser(null);
  };

  const openOrderDetails = (orderId: string) => {
    closeUserDetails();
    setDetailsOrderId(orderId);
  };

  const getFilterParams = () => ({
    q: searchTerm.trim() || undefined,
    status: statusFilter || undefined,
    paymentStatus: paymentFilter || undefined,
    currencyId: currencyFilter || undefined,
    from: toIso(fromDate),
    to: toIso(toDate),
  });

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await fetchOrders(getFilterParams());
      setOrders(data);

      if (canViewUsersPage) {
        try {
          const driverList = await fetchDrivers();
          setDrivers(driverList);
        } catch {
          setDrivers([]);
        }
      } else {
        setDrivers([]);
      }
      const currencyData = await fetchCurrencies();
      setCurrencies(currencyData.filter((currency) => currency.isActive));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedBranchId) return;
    load();
  }, [selectedBranchId, canViewUsersPage]);

  useEffect(() => {
    if (!selectedBranchId) return;
    const interval = setInterval(() => {
      if (!mutatingRef.current && !loading) load(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedBranchId, searchTerm, statusFilter, paymentFilter, currencyFilter, fromDate, toDate, loading]);

  const update = async (order: Order, status: string, paymentStatus?: string) => {
    mutatingRef.current = true;
    const previousStatus = order.status;
    const previousPayment = order.paymentStatus;
    setOrders((prev) =>
      prev.map((item) =>
        item._id === order._id
          ? { ...item, status, paymentStatus: paymentStatus ?? item.paymentStatus }
          : item
      )
    );
    try {
      const updated = await updateOrderStatus(order._id, status, paymentStatus);
      setOrders((prev) => prev.map((item) => (item._id === order._id ? updated : item)));
    } catch (error: any) {
      setOrders((prev) =>
        prev.map((item) =>
          item._id === order._id
            ? { ...item, status: previousStatus, paymentStatus: previousPayment }
            : item
        )
      );
      const message = error?.response?.data?.message || error?.message || "Failed to update order status";
      console.error("Order status update failed:", message);
      window.alert(message);
    } finally {
      mutatingRef.current = false;
    }
  };

  const saveDriverAssignment = async (order: Order, driverId: string) => {
    setAssigning((prev) => ({ ...prev, [order._id]: true }));
    mutatingRef.current = true;
    try {
      await updateOrderDetails(order._id, { driverId: driverId || null });
      await load(true);
    } finally {
      setAssigning((prev) => ({ ...prev, [order._id]: false }));
      mutatingRef.current = false;
    }
  };

  const startEdit = (order: Order) => {
    if (!canUpdateOrders) return;
    setEditingId(order._id);
    setEditDraft({
      status: order.status,
      driverId: getDriverIdValue(order.driverId),
      paymentStatus: order.paymentStatus,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
    setActiveEditPicker(null);
  };

  const saveEdit = async (order: Order) => {
    if (!editDraft) return;
    if (editDraft.driverId !== getDriverIdValue(order.driverId)) {
      await saveDriverAssignment(order, editDraft.driverId);
    }
    if (editDraft.status !== order.status || editDraft.paymentStatus !== order.paymentStatus) {
      await update(
        order,
        editDraft.status,
        editDraft.paymentStatus === order.paymentStatus ? undefined : editDraft.paymentStatus
      );
    }
    setEditingId(null);
    setEditDraft(null);
    setActiveEditPicker(null);
  };

  const renderBasketCard = (order: Order) => (
    <>
      <div className="orders-basket-card-heading">
        <button className="link-btn" type="button" onClick={() => openOrderDetails(order._id)}>#{order._id.slice(-6)}</button>
        <strong style={{ pointerEvents: 'none' }}>
          {formatOrderMoney(order.total, order.currency)}
        </strong>
      </div>

      <div className="orders-basket-card-heading" style={{ marginBottom: 10 }}>
        <div className="orders-basket-customer">
          {typeof order.user === "string" ? order.user : order.user.name || order.user.email}
        </div>

        <time className="muted" dateTime={order.createdAt}>
          {formatOrderDateTime(order.createdAt)}
        </time>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 5 }}>
        <div className="muted" style={{ pointerEvents: 'none' }}>
          {t("payment")} {order.paymentStatus.charAt(0)}{order.paymentStatus.substring(1,order.paymentStatus.length).toLowerCase()}
        </div>
        <div style={{ pointerEvents: 'none', display: 'flex', gap: 5 }}>
          <span className="muted">{order.paymentMethod}</span>
          {/* <StatusPill value={order.paymentStatus} /> */}
          
        </div>
      </div>

      <div style={{}}>
        <div className="muted">
          {t("driver")}: {getDriverLabel(order.driverId)}
        </div>
      </div>

      {/* {canUpdateOrders && ( 
        <label className="orders-basket-status">
          <span>{t("status")}</span>
          <select value={order.status} disabled={boardUpdatingId !== null}
            onChange={async event => {
              setBoardUpdatingId(order._id);
              try { await update(order, event.target.value); }
              finally { setBoardUpdatingId(null); }
            }}>
            {statuses.map(value => <option key={value} value={value}>{tStatus(value)}</option>)}
          </select>
        </label>
      )}*/}
      <button type="button" className="ghost-btn viewOrderBtn" onClick={() => openOrderDetails(order._id)}>{t("orders.openOrder")}</button>
    </>
  );

  return (
    <Card title={t("titles.orders")} subTitle={`(${orders.length})`}>

      <div className="page-header" style={{ padding: 0, marginBottom: 15 }}>
        <form
          className="filters"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <input
            className="filter-input"
            placeholder={t("searchUser")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">{t("status")}</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {tStatus(s)}
              </option>
            ))}
          </select>
          <select className="filter-select" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
            <option value="">{t("payment")}</option>
            <option value="PENDING">{tStatus("PENDING")}</option>
            <option value="CONFIRMED">{tStatus("CONFIRMED")}</option>
          </select>
          <select className="filter-select" value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value)}>
            <option value="">{t("currency") || "Currency"}</option>
            {currencies.map((currency) => (
              <option key={currency._id} value={currency._id}>
                {getCurrencySymbol(currency)}
              </option>
            ))}
          </select>
          <DatePicker
            className="filter-input date-picker"
            selected={fromDate}
            onChange={(date: Date | null) => setFromDate(date)}
            placeholderText={t("from") || "From"}
            showTimeInput
            timeFormat="HH:mm"
            timeIntervals={15}
            dateFormat="MM/dd/yyyy h:mm aa"
            isClearable
          />
          <DatePicker
            className="filter-input date-picker"
            selected={toDate}
            onChange={(date: Date | null) => setToDate(date)}
            placeholderText={t("till") || "Till"}
            showTimeInput
            timeFormat="HH:mm"
            timeIntervals={15}
            dateFormat="MM/dd/yyyy h:mm aa"
            isClearable
          />
          <button className="primary" type="submit">
            {t("filter")}
          </button>
          <button
            className="ghost-btn"
            type="button"
            onClick={() => {
              setSearchTerm("");
              setStatusFilter("");
              setPaymentFilter("");
              setCurrencyFilter("");
              setFromDate(null);
              setToDate(null);
              fetchOrders().then(setOrders);
            }}
          >
            {t("clear")}
          </button>
        </form>

        <div className="orders-view-switch" role="group" aria-label={t("orders.view")}>
          {(["basket", "table"] as const).map(option => (
            <button key={option} type="button" className={`orders-view-icon ${view === option ? "primary" : "ghost-btn"}`} aria-pressed={view === option}
              aria-label={t(`orders.${option}View`)} title={t(`orders.${option}View`)}
              onClick={() => { cancelEdit(); setView(option); localStorage.setItem("orders-view", option); }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {option === "basket" ? <>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 3v18M15 3v18M5.5 7h1M11.5 7h1M17.5 7h1M5.5 11h1M11.5 11h1M17.5 11h1M5.5 15h1M11.5 15h1" />
                </> : <>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M3 15h18M9 3v18" />
                </>}
              </svg>
            </button>
          ))}
        </div>
      </div>

      {view === "basket" ? (
        <DndContext sensors={sensors}
          collisionDetection={args => args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args)}
          onDragStart={({ active }) => {
            const order = orders.find(item => item._id === active.id);
            if (!order || !canUpdateOrders || boardUpdatingId) return;
            mutatingRef.current = true;
            setDraggedOrder(order);
            setDragStatus(order.status);
          }}
          onDragOver={({ over }) => setDragStatus(over ? String(over.id) : null)}
          onDragCancel={() => { setDraggedOrder(null); setDragStatus(null); mutatingRef.current = false; }}
          onDragEnd={async ({ over }) => {
            const order = draggedOrder;
            setDraggedOrder(null);
            setDragStatus(null);
            const status = over ? String(over.id) : "";
            if (!order || !canUpdateOrders || !statuses.includes(status) || status === order.status) {
              mutatingRef.current = false;
              return;
            }
            setBoardUpdatingId(order._id);
            try { await update(order, status); }
            finally { setBoardUpdatingId(null); }
          }}>
          <div className="orders-board" aria-label={t("orders.basketView")} aria-busy={loading}>
            {statuses.map(status => {
              const group = orders.filter(order => (order._id === draggedOrder?._id && dragStatus ? dragStatus : order.status) === status);
              return (
                <OrderDropBasket key={status} status={status} label={tStatus(status)} disabled={!canUpdateOrders || boardUpdatingId !== null}>
                  <header className="orders-basket-header">
                    <StatusPill value={status} />
                    <span className="orders-basket-count">{loading ? "—" : group.length}</span>
                  </header>
                  <div className="orders-basket-list">
                    {loading ? Array.from({ length: 3 }, (_, index) => (
                      <div className="orders-basket-card" key={index}>
                        <span className="skeleton-line w-80" />
                        <span className="skeleton-line w-140" />
                        <span className="skeleton-line w-100" />
                      </div>
                    )) : group.length === 0 ? <p className="orders-basket-empty muted">{t("noOrders")}</p> : group.map(order => (
                      <OrderDragCard key={order._id} id={order._id} disabled={!canUpdateOrders || boardUpdatingId !== null} label={`${t("orders.dragOrder")} #${order._id.slice(-6)}`} colorCode={tStatus(status)}>
                        {renderBasketCard(order)}
                      </OrderDragCard>
                    ))}
                  </div>
                </OrderDropBasket>
              );
            })}
          </div>
          {createPortal(<DragOverlay dropAnimation={window.matchMedia("(prefers-reduced-motion: reduce)").matches ? null : { duration: 280, easing: "cubic-bezier(.2,.8,.2,1)" }}>
            {draggedOrder ? <div className="orders-basket-card orders-card-ghost" aria-hidden="true">{renderBasketCard(draggedOrder)}</div> : null}
          </DragOverlay>, document.body)}
        </DndContext>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>{t("customer")}</th>
              <th>{t("orders.dateTime")}</th>
              <th>{t("status")}</th>
              <th>{t("payment")}</th>
              <th>{t("total")}</th>
              <th>{t("driver") ?? "Driver"}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="productRow">
                  <td><span className="skeleton-line w-80" /></td>
                  <td><span className="skeleton-line w-140" /></td>
                  <td><span className="skeleton-line w-140" /></td>
                  <td><span className="skeleton-line w-100" /></td>
                  <td><span className="skeleton-line w-120" /></td>
                  <td><span className="skeleton-line w-80" /></td>
                  <td><span className="skeleton-line w-120" /></td>
                  <td><span className="skeleton-line w-120" /></td>
                </tr>
              ))
            ) : orders.length == 0 ? (
              <tr>
                <td colSpan={8} className="muted">{t("noOrders")}</td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order._id} id={`order-row-${order._id}`}>
                  <td>
                    <button className="link-btn" type="button" onClick={() => openOrderDetails(order._id)}>
                      {order._id.slice(-6)}
                    </button>
                  </td>
                  <td>
                    {canOpenUserDetails && getOrderUserId(order) ? (
                      <button
                        className="link-btn"
                        type="button"
                        onClick={() => loadUserDetails(getOrderUserId(order))}
                        disabled={userDetailsLoading === getOrderUserId(order)}
                      >
                        {userDetailsLoading === getOrderUserId(order) ? <div className="spinner small"></div> : getOrderUserLabel(order)}
                      </button>
                    ) : (
                      getOrderUserLabel(order)
                    )}
                  </td>
                  <td>{formatOrderDateTime(order.createdAt)}</td>
                  <td>
                    {editingId === order._id && editDraft ? (
                      <button className="onHoverEdit" style={{ "backgroundColor": "transparent", "border": "none", "padding": 0 }} type="button" onClick={() => setActiveEditPicker("status")}>
                        <StatusPill value={editDraft.status} />
                      </button>
                    ) : (
                      <StatusPill value={order.status} />
                    )}
                  </td>
                  <td>
                    {editingId === order._id && editDraft ? (
                      <>
                        <StatusPill value={editDraft.paymentStatus} /> {order.paymentMethod}
                        {(order.paymentMethod === "SHAM_CASH" || order.paymentMethod === "BANK_TRANSFER") && editDraft.paymentStatus !== "CONFIRMED" && (
                          <button
                            className="ghost-btn"
                            type="button"
                            onClick={() => setEditDraft((prev) => (prev ? { ...prev, paymentStatus: "CONFIRMED" } : prev))}
                          >
                            {t("confirmPayment")}
                          </button>
                        )}
                      </>
                    ) : (
                      <div style={{}}>
                        <StatusPill value={order.paymentStatus} />
                        <div style={{ "fontSize": 12 }}>{order.paymentMethod}</div>
                      </div>
                    )}
                  </td>
                  <td>{formatOrderMoney(order.total, order.currency)}</td>
                  <td>
                    {editingId === order._id && editDraft ? (
                      drivers.length === 0 ? (
                        <span className="muted">-</span>
                      ) : (
                        <button
                          className="link-btn onHoverEdit"
                          type="button"
                          onClick={() => setActiveEditPicker("driver")}
                          disabled={assigning[order._id]}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                          }}
                        >
                          {editDraft.driverId
                            ? getDriver(editDraft.driverId)?.name || (t("selectDriver") ?? "Select driver")
                            : t("selectDriver") ?? "Select driver"}
                        </button>
                      )
                    ) : (
                      getDriverLabel(order.driverId)
                    )}
                  </td>
                  <td>
                    {canUpdateOrders ? (
                      editingId === order._id ? (
                        <div style={{ display: "flex", gap: 5 }}>
                          <button
                            className="primary"
                            type="button"
                            onClick={() => saveEdit(order)}
                            disabled={assigning[order._id]}
                          >
                            {t("save")}
                          </button>
                          <button className="ghost-btn" type="button" onClick={cancelEdit}>
                            {t("cancel")}
                          </button>
                        </div>
                      ) : (
                        <button className="primary" type="button" onClick={() => startEdit(order)}>
                          {t("edit")}
                        </button>
                      )
                    ) : (
                      <div className="muted"></div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {detailsOrderId && <OrderDetailsModal orderId={detailsOrderId} onClose={() => { setDetailsOrderId(null); load(true); }} />}
      {selectedUser && (
        <div className="modal-backdrop" onClick={closeUserDetails}>
          <div className="modal user-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                {t("titles.userDetail")} <span className="muted" style={{ fontWeight: "normal", fontSize: "12px" }}>{selectedUser.user._id}</span>
              </div>
              <button className="ghost-btn" type="button" onClick={closeUserDetails}>
                {t("close")}
              </button>
            </div>

            <div className="user-details-tab-panel">
              {canViewUserAbout && (
                <div className="detailsTable">
                  <div className="detailsRow">
                    <div className="detailsLabel">{t("name")}</div>
                    <div className="detailsValue">{selectedUser.user.name || "—"}</div>
                  </div>
                  <div className="detailsRow">
                    <div className="detailsLabel">{t("email")}</div>
                    <div className="detailsValue">{selectedUser.user.email || "—"}</div>
                  </div>
                  <div className="detailsRow">
                    <div className="detailsLabel">{t("phone")}</div>
                    <div className="detailsValue">{selectedUser.user.phone || t("noPhone")}</div>
                  </div>
                  <div className="detailsRow">
                    <div className="detailsLabel">{t("role")}</div>
                    <div className="detailsValue">{t(`role.${selectedUser.user.role}`) || selectedUser.user.role}</div>
                  </div>
                  <div className="detailsRow">
                    <div className="detailsLabel">{t("membership")}</div>
                    <div className="detailsValue">{selectedUser.user.membershipLevel || "—"}</div>
                  </div>
                  <div className="detailsRow">
                    <div className="detailsLabel">{t("addresses")} ({selectedUser.addresses?.length || 0})</div>
                    <div className="detailsValue">
                      {selectedUser.addresses?.length ? (
                        <ul className="addressList">
                          {selectedUser.addresses.map((addr) => (
                            <li key={addr._id}>
                              {addr.label}: {addr.address}
                              {addr.phone ? ` (${addr.phone})` : ""}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="muted">{t("noAddresses")}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {canViewOrders && (
                <div className="detailsTable" style={{ marginTop: 16 }}>
                  <div className="detailsRow">
                    <div className="detailsLabel">{t("orders.recentOrders")}</div>
                    <div className="detailsValue">
                      {selectedUserRecentOrders.length ? (
                        <div className="list">
                          {selectedUserRecentOrders.map((order) => (
                            <div key={order._id} className="list-row">
                              <div>
                                <div>
                                  <strong>{order._id.slice(-6)}</strong>
                                </div>
                                <div className="muted">{formatOrderDateTime(order.createdAt)}</div>
                                <div className="muted">
                                  <StatusPill value={order.status} />
                                </div>
                              </div>
                              <button className="ghost-btn" type="button" onClick={() => openOrderDetails(order._id)}>
                                {t("orders.viewOrder")}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="muted">{t("noOrders")}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {editingId && editDraft && activeEditPicker && (
        <div className="modal-backdrop" onClick={() => setActiveEditPicker(null)}>
          <div className="modal" style={{ width: "min(420px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{activeEditPicker === "status" ? t("status") : (t("driver") ?? "Driver")}</div>
              <button className="ghost-btn" type="button" onClick={() => setActiveEditPicker(null)}>
                {t("close")}
              </button>
            </div>
            <div className="list">
              {activeEditPicker === "status" ? (
                statuses.map((status) => (
                  <button
                    key={status}
                    className="driver-picker-option"
                    type="button"
                    onClick={() => {
                      setEditDraft((prev) => (prev ? { ...prev, status } : prev));
                      setActiveEditPicker(null);
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <strong>{tStatus(status)}</strong>
                      <StatusPill value={status} />
                    </div>
                  </button>
                ))
              ) : (
                <>
                  <button
                    className={`driver-picker-option${editDraft.driverId === "" ? " active" : ""}`}
                    type="button"
                    onClick={() => {
                      setEditDraft((prev) => (prev ? { ...prev, driverId: "" } : prev));
                      setActiveEditPicker(null);
                    }}
                  >
                    <strong>{t("selectDriver") ?? "Select driver"}</strong>
                  </button>
                  {drivers.map((driver) => (
                    <button
                      key={driver._id}
                      className={`driver-picker-option${editDraft.driverId === driver._id ? " active" : ""}`}
                      type="button"
                      onClick={() => {
                        setEditDraft((prev) => (prev ? { ...prev, driverId: driver._id } : prev));
                        setActiveEditPicker(null);
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <strong>{driver.name}</strong>
                        <span className={getDriverStatusClassName(driver)}>{getDriverStatusLabel(driver)}</span>
                      </div>
                      <span className="rtlFix" style={{ opacity: 0.6 }}>{driver.email}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default OrdersPage;
