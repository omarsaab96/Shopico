import { useEffect, useRef, useState } from "react";
import Card from "../components/Card";
import StatusPill from "../components/StatusPill";
import { assignOrderDriver, fetchDrivers, fetchOrders, updateOrderStatus } from "../api/client";
import type { ApiUser, Order } from "../types/api";
import { useI18n } from "../context/I18nContext";
import { usePermissions } from "../hooks/usePermissions";
import { useBranch } from "../context/BranchContext";

const statuses = ["PENDING", "PROCESSING", "SHIPPING", "DELIVERED", "CANCELLED"];

const OrdersPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [drivers, setDrivers] = useState<ApiUser[]>([]);
  const [assigning, setAssigning] = useState<Record<string, boolean>>({});
  const mutatingRef = useRef(false);
  const { t, tStatus } = useI18n();
  const { can } = usePermissions();
  const { selectedBranchId } = useBranch();
  const canUpdateOrders = can("orders:update");

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
          <button className="ghost-btn" type="button" onClick={load}>
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
                <td><span className="skeleton-line w-100" /></td>
                <td><span className="skeleton-line w-120" /></td>
                <td><span className="skeleton-line w-80" /></td>
                <td><span className="skeleton-line w-120" /></td>
                <td><span className="skeleton-line w-120" /></td>
              </tr>
            ))
          ) : orders.length == 0 ? (
            <tr>
              <td colSpan={7} className="muted">{t("noOrders")}</td>
            </tr>
          ) : (
            orders.map((order) => (
              <tr key={order._id}>
                <td>{order._id.slice(-6)}</td>
                <td>{typeof order.user === "string" ? order.user : order.user.email}</td>
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
                    <div className="muted">{t("noPermissionAction")}</div>
                  )}
                </td>
              </tr>
            ))
          )}

        </tbody>
      </table>
    </Card>
  );
};

export default OrdersPage;
