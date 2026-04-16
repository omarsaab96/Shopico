import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Card from "../components/Card";
import StatusPill from "../components/StatusPill";
import { fetchOrderById } from "../api/client";
import type { Order, Product } from "../types/api";
import { useI18n } from "../context/I18nContext";

const orderDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return orderDateTimeFormatter.format(parsed);
};

const formatMoney = (value?: number) => (typeof value === "number" ? value.toLocaleString() : "0");

const getProductName = (product: Product | string) => (typeof product === "string" ? product : product.name);

const OrderDetailsPage = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { t, tStatus } = useI18n();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      setError("Order not found");
      setLoading(false);
      return;
    }

    const loadOrder = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await fetchOrderById(id);
        setOrder(data);
      } catch (err: any) {
        const message = err?.response?.data?.message || err?.message || "Failed to load order";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [id]);

  const customer = useMemo(() => (typeof order?.user === "string" ? null : order?.user || null), [order]);

  if (loading) {
    return (
      <div className="loader">
        <div className="spinner"></div>
        <div className="loaderText">{t("loading")}</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <Card
        title={t("orders.orderDetails")}
        subTitle=""
        actions={
          <button className="ghost-btn" type="button" onClick={() => navigate("/orders")}>
            {t("back")}
          </button>
        }
      >
        <div className="error">{error || "Order not found"}</div>
      </Card>
    );
  }

  return (
    <div className="grid">
      <Card
        title={t("orders.orderDetails")}
        subTitle={`#${order._id.slice(-6)}`}
        actions={
          <button className="ghost-btn" type="button" onClick={() => navigate("/orders")}>
            {t("back")}
          </button>
        }
      >
        <div className="detail-grid">
          <div className="stat">
            <div className="stat-label">{t("status")}</div>
            <div className="stat-value"><StatusPill value={order.status} /></div>
          </div>
          <div className="stat">
            <div className="stat-label">{t("payment")}</div>
            <div className="stat-value"><StatusPill value={order.paymentStatus} /></div>
          </div>
          <div className="stat">
            <div className="stat-label">{t("total")}</div>
            <div className="stat-value">{formatMoney(order.total)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">{t("orders.dateTime")}</div>
            <div className="stat-value">{formatDateTime(order.createdAt)}</div>
          </div>
        </div>

        <div className="two-col">
          <div className="ledger-group">
            <h4>{t("orders.summary")}</h4>
            <div className="detailsTable">
              <div className="detailsRow">
                <div className="detailsLabel">{t("customer")}</div>
                <div className="detailsValue">{customer?.name || customer?.email || String(order.user)}</div>
              </div>
              <div className="detailsRow">
                <div className="detailsLabel">{t("email")}</div>
                <div className="detailsValue">{customer?.email || "-"}</div>
              </div>
              <div className="detailsRow">
                <div className="detailsLabel">{t("phone")}</div>
                <div className="detailsValue">{customer?.phone || t("noPhone")}</div>
              </div>
              <div className="detailsRow">
                <div className="detailsLabel">{t("driver")}</div>
                <div className="detailsValue">{order.driverId || "-"}</div>
              </div>
              <div className="detailsRow">
                <div className="detailsLabel">{t("method")}</div>
                <div className="detailsValue">{order.paymentMethod}</div>
              </div>
              <div className="detailsRow">
                <div className="detailsLabel">{t("address")}</div>
                <div className="detailsValue">{order.address}</div>
              </div>
              <div className="detailsRow">
                <div className="detailsLabel">{t("note")}</div>
                <div className="detailsValue">{order.notes || "-"}</div>
              </div>
            </div>
          </div>

          <div className="ledger-group">
            <h4>{t("orders.charges")}</h4>
            <div className="detailsTable">
              <div className="detailsRow">
                <div className="detailsLabel">{t("orders.subtotal")}</div>
                <div className="detailsValue">{formatMoney(order.subtotal)}</div>
              </div>
              <div className="detailsRow">
                <div className="detailsLabel">{t("orders.deliveryFee")}</div>
                <div className="detailsValue">{formatMoney(order.deliveryFee)}</div>
              </div>
              <div className="detailsRow">
                <div className="detailsLabel">{t("discount")}</div>
                <div className="detailsValue">{formatMoney(order.discount)}</div>
              </div>
              <div className="detailsRow">
                <div className="detailsLabel">{t("orders.couponCodes")}</div>
                <div className="detailsValue">{order.couponCodes?.length ? order.couponCodes.join(", ") : order.couponCode || "-"}</div>
              </div>
              <div className="detailsRow">
                <div className="detailsLabel">{t("orders.distanceKm")}</div>
                <div className="detailsValue">{typeof order.deliveryDistanceKm === "number" ? order.deliveryDistanceKm.toFixed(2) : "-"}</div>
              </div>
              <div className="detailsRow">
                <div className="detailsLabel">{t("orders.rewardApplied")}</div>
                <div className="detailsValue">{order.rewardApplied ? t("yes") : t("no")}</div>
              </div>
              <div className="detailsRow">
                <div className="detailsLabel">{t("total")}</div>
                <div className="detailsValue"><strong>{formatMoney(order.total)}</strong></div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card title={t("orders.items")} subTitle={`(${order.items.length})`}>
        <table className="table">
          <thead>
            <tr>
              <th>{t("name")}</th>
              <th>{t("price")}</th>
              <th>{t("orders.quantity")}</th>
              <th>{t("total")}</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, index) => (
              <tr key={`${getProductName(item.product)}-${index}`}>
                <td>{getProductName(item.product)}</td>
                <td>{formatMoney(item.price)}</td>
                <td>{item.quantity}</td>
                <td>{formatMoney(item.price * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title={t("orders.timeline")} subTitle={`(${order.statusHistory?.length || 0})`}>
        {order.statusHistory?.length ? (
          <div className="list">
            {order.statusHistory.map((entry, index) => (
              <div key={`${entry.status}-${entry.at}-${index}`} className="list-row">
                <div>
                  <strong>{tStatus(entry.status)}</strong>
                  <div className="muted">{formatDateTime(entry.at)}</div>
                </div>
                <StatusPill value={entry.status} />
              </div>
            ))}
          </div>
        ) : (
          <div className="muted">{t("noOrders")}</div>
        )}
      </Card>
    </div>
  );
};

export default OrderDetailsPage;
