import { useEffect, useState } from "react";
import Card from "../components/Card";
import StatusPill from "../components/StatusPill";
import { fetchOrders, updateOrderStatus } from "../api/client";
import type { Order } from "../types/api";
import { useI18n } from "../context/I18nContext";
import { usePermissions } from "../hooks/usePermissions";
import { useBranch } from "../context/BranchContext";

const statuses = ["PENDING", "PROCESSING", "SHIPPING", "DELIVERED", "CANCELLED"];

const OrdersPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const { t, tStatus } = useI18n();
  const { can } = usePermissions();
  const { selectedBranchId } = useBranch();
  const canUpdateOrders = can("orders:update");

  const getFilterParams = () => ({
    q: searchTerm.trim() || undefined,
    status: statusFilter || undefined,
    paymentStatus: paymentFilter || undefined,
  });

  const load = () => fetchOrders(getFilterParams()).then(setOrders);
  useEffect(() => {
    if (!selectedBranchId) return;
    load();
  }, [selectedBranchId]);

  const update = async (order: Order, status: string, paymentStatus?: string) => {
    await updateOrderStatus(order._id, status, paymentStatus);
    load();
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
            <th></th>
          </tr>
        </thead>
        <tbody>
          {orders.length == 0 ? (
            <tr>
              <td colSpan={6} className="muted">{t("noOrders")}</td>
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
                  <select
                    value={order.status}
                    onChange={(e) => update(order, e.target.value)}
                    disabled={!canUpdateOrders}
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
                      disabled={!canUpdateOrders}
                    >
                      {t("confirmPayment")}
                    </button>
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
