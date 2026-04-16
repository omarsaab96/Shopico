import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Card from "../components/Card";
import StatusPill from "../components/StatusPill";
import api, { fetchOrderById } from "../api/client";
import type { ApiUser, Order, Product } from "../types/api";
import { useI18n } from "../context/I18nContext";
import { usePermissions } from "../hooks/usePermissions";

const USER_ABOUT_VIEW_PERMISSIONS = ["users:about:view"] as const;
const USER_BRANCHES_VIEW_PERMISSIONS = ["users:branches:view"] as const;

interface UserDetails {
  user: ApiUser;
  wallet?: { balance: number };
  walletTx: { amount: number; type: string; source: string; createdAt: string }[];
  pointTx: { points: number; type: string; createdAt: string }[];
  addresses: { _id: string; label: string; address: string; phone?: string }[];
}

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

const getProductName = (product: Product | string | null | undefined, fallbackLabel: string) => {
  if (!product) return fallbackLabel;
  return typeof product === "string" ? product : product.name;
};

const OrderDetailsPage = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { t, tStatus } = useI18n();
  const { can, canAny } = usePermissions();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userDetailsLoading, setUserDetailsLoading] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
  const [driverUser, setDriverUser] = useState<ApiUser | null>(null);
  const canViewUsersPage = can("users:view");
  const canViewUserAbout = canAny(...USER_ABOUT_VIEW_PERMISSIONS);
  const canViewUserLedger = can("users:ledger:view");
  const canViewUserBranches = canAny(...USER_BRANCHES_VIEW_PERMISSIONS);
  const canOpenUserDetails =
    canViewUsersPage && (canViewUserAbout || canViewUserLedger || canViewUserBranches);

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

  useEffect(() => {
    const driverId = typeof order?.driverId === "string" ? order.driverId : "";
    if (!driverId) {
      setDriverUser(typeof order?.driverId === "string" ? null : order?.driverId || null);
      return;
    }
    if (!canViewUsersPage) {
      setDriverUser(null);
      return;
    }

    let cancelled = false;
    const loadDriver = async () => {
      try {
        const res = await api.get<{ data: UserDetails }>(`/users/${driverId}`);
        if (!cancelled) {
          setDriverUser(res.data.data.user);
        }
      } catch {
        if (!cancelled) {
          setDriverUser(null);
        }
      }
    };

    loadDriver();
    return () => {
      cancelled = true;
    };
  }, [order?.driverId, canViewUsersPage]);

  const customer = useMemo(() => (typeof order?.user === "string" ? null : order?.user || null), [order]);
  const driver = useMemo(
    () => (order?.driverId && typeof order.driverId !== "string" ? order.driverId : driverUser),
    [order, driverUser]
  );
  const unknownProductLabel = "Unknown product";
  const customerId = typeof order?.user === "string" ? order.user : order?.user?._id || "";
  const driverId = typeof order?.driverId === "string" ? order.driverId : order?.driverId?._id || "";

  const loadUserDetails = async (userId: string) => {
    if (!canOpenUserDetails || !userId) return;
    setUserDetailsLoading(userId);
    try {
      const res = await api.get<{ data: UserDetails }>(`/users/${userId}`);
      setSelectedUser(res.data.data);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Failed to load user details";
      window.alert(message);
    } finally {
      setUserDetailsLoading("");
    }
  };

  const closeUserDetails = () => {
    setSelectedUser(null);
  };

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
        subTitle={`${order._id.slice(-6)}`}
        actions={
          <button className="ghost-btn" type="button" onClick={() => navigate("/orders")}>
            {t("back")}
          </button>
        }
      >
        <div className="detail-grid">
          <div className="stat">
            <div className="stat-label">{t("status")}</div>
            <div className="stat-value"><StatusPill value={order.status} size="big"/></div>
          </div>
          <div className="stat">
            <div className="stat-label">{t("payment")}</div>
            <div className="stat-value"><StatusPill value={order.paymentStatus} size="big"/></div>
          </div>
          <div className="stat">
            <div className="stat-label">{t("total")}</div>
            <div className="stat-value">{formatMoney(order.total)} {t("syp").toUpperCase()}</div>
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
                <div className="detailsValue">
                  {canOpenUserDetails && customerId ? (
                    <button
                      className="link-btn"
                      type="button"
                      onClick={() => loadUserDetails(customerId)}
                      disabled={userDetailsLoading === customerId}
                    >
                      {userDetailsLoading === customerId ? <div className="spinner small"></div> : customer?.name || customer?.email || String(order.user)}
                    </button>
                  ) : (
                    customer?.name || customer?.email || String(order.user)
                  )}
                </div>
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
                <div className="detailsValue">
                  {canOpenUserDetails && driverId ? (
                    <button
                      className="link-btn"
                      type="button"
                      onClick={() => loadUserDetails(driverId)}
                      disabled={userDetailsLoading === driverId}
                    >
                      {userDetailsLoading === driverId ? <div className="spinner small"></div> : driver?.name || driver?.email || driverId}
                    </button>
                  ) : (
                    driver?.name || driver?.email || driverId || "-"
                  )}
                </div>
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
                <div className="detailsValue">{formatMoney(order.subtotal)} {t("syp").toUpperCase()}</div>
              </div>
              <div className="detailsRow">
                <div className="detailsLabel">{t("orders.deliveryFee")}</div>
                <div className="detailsValue">{formatMoney(order.deliveryFee)} {t("syp").toUpperCase()}</div>
              </div>
              <div className="detailsRow">
                <div className="detailsLabel">{t("discount")}</div>
                <div className="detailsValue">{formatMoney(order.discount)} {t("syp").toUpperCase()}</div>
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
                <div className="detailsValue"><strong>{formatMoney(order.total)} {t("syp").toUpperCase()}</strong></div>
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
              <tr key={`${getProductName(item.product, unknownProductLabel)}-${index}`}>
                <td>{getProductName(item.product, unknownProductLabel)}</td>
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
                    <div className="detailsValue">{selectedUser.user.name || "-"}</div>
                  </div>
                  <div className="detailsRow">
                    <div className="detailsLabel">{t("email")}</div>
                    <div className="detailsValue">{selectedUser.user.email || "-"}</div>
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
                    <div className="detailsValue">{selectedUser.user.membershipLevel || "-"}</div>
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderDetailsPage;
