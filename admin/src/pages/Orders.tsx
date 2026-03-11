import { useEffect, useRef, useState } from "react";
import Card from "../components/Card";
import StatusPill from "../components/StatusPill";
import api, { assignOrderDriver, fetchDrivers, fetchOrders, updateOrderStatus } from "../api/client";
import type { ApiUser, Order } from "../types/api";
import { useI18n } from "../context/I18nContext";
import { usePermissions } from "../hooks/usePermissions";
import { useBranch } from "../context/BranchContext";

const statuses = ["PENDING", "PROCESSING", "SHIPPING", "DELIVERED", "CANCELLED"];
const USER_ABOUT_VIEW_PERMISSIONS = ["users:about:view", "users:about:manage"] as const;
const USER_LEDGER_VIEW_PERMISSIONS = ["users:ledger:view", "users:ledger:manage"] as const;
const USER_BRANCHES_VIEW_PERMISSIONS = ["users:branches:view", "users:branches:manage"] as const;
const USER_PERMISSIONS_VIEW_PERMISSIONS = ["users:permissions:view", "users:permissions:manage"] as const;

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

const OrdersPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [drivers, setDrivers] = useState<ApiUser[]>([]);
  const [assigning, setAssigning] = useState<Record<string, boolean>>({});
  const [userDetailsLoading, setUserDetailsLoading] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
  const mutatingRef = useRef(false);
  const { t, tStatus } = useI18n();
  const { can, canAny } = usePermissions();
  const { selectedBranchId } = useBranch();
  const canUpdateOrders = can("orders:update");
  const canViewUsersPage = can("users:view");
  const canViewUserAbout = canAny(...USER_ABOUT_VIEW_PERMISSIONS);
  const canViewUserLedger = canAny(...USER_LEDGER_VIEW_PERMISSIONS);
  const canViewUserBranches = canAny(...USER_BRANCHES_VIEW_PERMISSIONS);
  const canViewUserPermissions = canAny(...USER_PERMISSIONS_VIEW_PERMISSIONS);
  const canOpenUserDetails =
    canViewUsersPage && (canViewUserAbout || canViewUserLedger || canViewUserBranches || canViewUserPermissions);

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

  const getFilterParams = () => ({
    q: searchTerm.trim() || undefined,
    status: statusFilter || undefined,
    paymentStatus: paymentFilter || undefined,
  });

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [data, driverList] = await Promise.all([fetchOrders(getFilterParams()), fetchDrivers()]);
      setOrders(data);
      setDrivers(driverList);
    } finally {
      if (!silent) setLoading(false);
    }
  };
  useEffect(() => {
    if (!selectedBranchId) return;
    load();
  }, [selectedBranchId]);
  useEffect(() => {
    if (!selectedBranchId) return;
    const interval = setInterval(() => {
      if (!mutatingRef.current && !loading) load(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedBranchId, searchTerm, statusFilter, paymentFilter, loading]);

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

  const assignDriver = async (order: Order, driverId: string) => {
    setAssigning((prev) => ({ ...prev, [order._id]: true }));
    mutatingRef.current = true;
    try {
      await assignOrderDriver(order._id, driverId);
      await load(true);
    } finally {
      setAssigning((prev) => ({ ...prev, [order._id]: false }));
      mutatingRef.current = false;
    }
  };

  return (
    <Card title={t("titles.orders")} subTitle={`(${orders.length})`}>
      <div className="page-header" style={{ padding: 0, marginBottom: 12 }}>
        <div className="filters">
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
          <button className="ghost-btn" type="button" onClick={() => load()}>
            {t("filter")}
          </button>
          <button
            className="ghost-btn"
            type="button"
            onClick={() => {
              setSearchTerm("");
              setStatusFilter("");
              setPaymentFilter("");
              fetchOrders().then(setOrders);
            }}
          >
            {t("clear")}
          </button>
        </div>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>{t("titles.orders")}</th>
            <th>{t("customer")}</th>
            <th>Date & Time</th>
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
              <tr key={order._id}>
                <td>{order._id.slice(-6)}</td>
                <td>
                  {canOpenUserDetails && getOrderUserId(order) ? (
                    <button
                      className="ghost-btn"
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
                  <StatusPill value={order.status} />
                </td>
                <td>
                  <StatusPill value={order.paymentStatus} /> {order.paymentMethod}
                </td>
                <td>{order.total.toLocaleString()}</td>
                <td>
                  {drivers.length === 0 ? (
                    <span className="muted">—</span>
                  ) : (
                    <select
                      value={order.driverId || ""}
                      onChange={(e) => assignDriver(order, e.target.value)}
                      disabled={!canUpdateOrders || assigning[order._id]}
                    >
                      <option value="">{t("selectDriver") ?? "Select driver"}</option>
                      {drivers.map((driver) => (
                        <option key={driver._id} value={driver._id}>
                          {driver.name} ({driver.email})
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td>
                  {canUpdateOrders ? (
                    <>
                      <select
                        value={order.status}
                        onChange={(e) => update(order, e.target.value)}
                      >
                        {statuses.map((s) => (
                          <option key={s} value={s}>
                            {tStatus(s)}
                          </option>
                        ))}
                      </select>
                      {(order.paymentMethod === "SHAM_CASH" || order.paymentMethod === "BANK_TRANSFER") && (
                        <button
                          className="ghost-btn"
                          onClick={() => update(order, order.status, "CONFIRMED")}
                        >
                          {t("confirmPayment")}
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="muted"></div>
                  )}
                </td>
              </tr>
            ))
          )}

        </tbody>
      </table>
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

              {canViewUserLedger && (
                <div className="two-col">
                  <div className="ledger-group">
                    <h4>{t("walletBalance")}</h4>
                    <div>{selectedUser.wallet?.balance?.toLocaleString() || 0} SYP</div>
                  </div>
                  <div className="ledger-group">
                    <h4>{t("points")}</h4>
                    <div>{selectedUser.user.points || 0}</div>
                  </div>
                </div>
              )}

              {canViewUserBranches && (
                <div className="detailsTable" style={{ marginTop: 16 }}>
                  <div className="detailsRow">
                    <div className="detailsLabel">{t("branches")}</div>
                    <div className="detailsValue">
                      {selectedUser.user.branchIds?.length ? selectedUser.user.branchIds.join(", ") : <span className="muted">{t("noBranches")}</span>}
                    </div>
                  </div>
                </div>
              )}

              {canViewUserPermissions && selectedUser.user.role !== "customer" && (
                <div className="detailsTable" style={{ marginTop: 16 }}>
                  <div className="detailsRow">
                    <div className="detailsLabel">{t("permissions")}</div>
                    <div className="detailsValue">
                      {selectedUser.user.permissions?.length ? selectedUser.user.permissions.join(", ") : <span className="muted">—</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default OrdersPage;
