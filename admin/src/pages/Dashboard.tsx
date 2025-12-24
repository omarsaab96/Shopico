import { useEffect, useState } from "react";
import Card from "../components/Card";
import { fetchOrders, fetchProducts } from "../api/client";
import type { Order, Product } from "../types/api";
import StatusPill from "../components/StatusPill";

const DashboardPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetchOrders().then(setOrders).catch(console.error);
    fetchProducts().then(setProducts).catch(console.error);
  }, []);

  const revenue = orders.reduce((sum, o) => sum + o.total, 0);
  const pending = orders.filter((o) => o.status !== "DELIVERED" && o.status !== "CANCELLED").length;

  return (
    <div className="grid">
      <Card title="Store Pulse" subTitle="">
        <div className="stats-grid">
          <div className="stat">
            <div className="stat-label">Revenue (SYP)</div>
            <div className="stat-value">{revenue.toLocaleString()}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Open Orders</div>
            <div className="stat-value">{pending}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Products</div>
            <div className="stat-value">{products.length}</div>
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
            {orders.length == 0 ? (
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
