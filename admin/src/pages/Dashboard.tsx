import { useEffect, useState } from "react";
import Card from "../components/Card";
import { fetchOrders, fetchProducts } from "../api/client";
import type { Order, Product } from "../types/api";
import StatusPill from "../components/StatusPill";
import { usePermissions } from "../hooks/usePermissions";
import { useI18n } from "../context/I18nContext";

const DashboardPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const { can } = usePermissions();
  const { t } = useI18n();
  const canViewOrders = can("orders:view");
  const canViewProducts = can("products:view");

  useEffect(() => {
    if (canViewOrders) {
      fetchOrders().then(setOrders).catch(console.error);
    }
    if (canViewProducts) {
      fetchProducts().then(setProducts).catch(console.error);
    }
  }, [canViewOrders, canViewProducts]);

  const revenue = canViewOrders ? orders.reduce((sum, o) => sum + o.total, 0) : 0;
  const pending = canViewOrders
    ? orders.filter((o) => o.status !== "DELIVERED" && o.status !== "CANCELLED").length
    : 0;

  return (
    <div className="grid">
      <Card title="Store Pulse" subTitle="">
        <div className="stats-grid">
          <div className="stat">
            <div className="stat-label">Revenue (SYP)</div>
            <div className="stat-value">{canViewOrders ? revenue.toLocaleString() : t("noPermissionAction")}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Open Orders</div>
            <div className="stat-value">{canViewOrders ? pending : t("noPermissionAction")}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Products</div>
            <div className="stat-value">{canViewProducts ? products.length : t("noPermissionAction")}</div>
          </div>
        </div>
      </Card>
      <Card title="Recent Orders" subTitle="">
        <table className="table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {!canViewOrders ? (
              <tr>
                <td colSpan={6} className="muted">{t("noPermissionAction")}</td>
              </tr>
            ) : orders.length == 0 ? (
              <tr>
                <td colSpan={6} className="muted">No orders</td>
              </tr>
            ) : (
              orders.slice(0, 5).map((order) => (
                <tr key={order._id}>
                  <td>{order._id.slice(-6)}</td>
                  <td>{typeof order.user === "string" ? order.user : order.user.email}</td>
                  <td>
                    <StatusPill value={order.status} />
                  </td>
                  <td>{order.total.toLocaleString()} SYP</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

export default DashboardPage;
