import { useEffect, useState } from "react";
import Card from "../components/Card";
import StatusPill from "../components/StatusPill";
import { fetchOrders, updateOrderStatus } from "../api/client";
import type { Order } from "../types/api";

const statuses = ["PENDING", "PROCESSING", "SHIPPING", "DELIVERED", "CANCELLED"];

const OrdersPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);

  const load = () => fetchOrders().then(setOrders);
  useEffect(() => {
    load();
  }, []);

  const update = async (order: Order, status: string, paymentStatus?: string) => {
    await updateOrderStatus(order._id, status, paymentStatus);
    load();
  };

  return (
    <Card title="Orders" subTitle={`(${orders.length})`}>
      <table className="table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Status</th>
            <th>Payment</th>
            <th>Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
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
                <select value={order.status} onChange={(e) => update(order, e.target.value)}>
                  {statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                {(order.paymentMethod === "SHAM_CASH" || order.paymentMethod === "BANK_TRANSFER") && (
                  <button className="ghost-btn" onClick={() => update(order, order.status, "CONFIRMED")}>
                    Confirm Payment
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
};

export default OrdersPage;
