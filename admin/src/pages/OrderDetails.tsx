import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Card from "../components/Card";
import StatusPill from "../components/StatusPill";
import api, { fetchCoupons, fetchDrivers, fetchOrderById, updateOrderDetails, updateOrderStatus } from "../api/client";
import type { ApiUser, Coupon, Order, Product } from "../types/api";
import { useI18n } from "../context/I18nContext";
import { usePermissions } from "../hooks/usePermissions";

const USER_ABOUT_VIEW_PERMISSIONS = ["users:about:view"] as const;
const USER_BRANCHES_VIEW_PERMISSIONS = ["users:branches:view"] as const;
const statuses = ["PENDING", "PROCESSING", "SHIPPING", "DELIVERED", "CANCELLED"] as const;

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

type PickerType = "status" | "driver" | null;

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
  const [drivers, setDrivers] = useState<ApiUser[]>([]);
  const [driverDraft, setDriverDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("");
  const [driverSaving, setDriverSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [detailsSuccess, setDetailsSuccess] = useState("");
  const [activePicker, setActivePicker] = useState<PickerType>(null);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");
  const canViewOrders = can("orders:view");
  const canUpdateOrders = canViewOrders && can("orders:update");
  const canViewCoupons = can("coupons:view");
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
    if (!canViewUsersPage) {
      setDrivers([]);
      return;
    }
    fetchDrivers().then(setDrivers).catch(() => setDrivers([]));
  }, [canViewUsersPage]);

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

  useEffect(() => {
    setDriverDraft(driverId);
    setStatusDraft(order?.status || "");
    setDetailsError("");
    setDetailsSuccess("");
    setDriverSaving(false);
    setStatusSaving(false);
  }, [order?._id, order?.status, driverId]);

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

  const closePicker = () => {
    if (driverSaving || statusSaving) return;
    setActivePicker(null);
  };

  const closeCoupon = () => {
    setSelectedCoupon(null);
    setCouponError("");
    setCouponLoading(false);
  };

  const openCouponDetails = async (code: string) => {
    if (!canViewCoupons || !code) return;
    setCouponLoading(true);
    setCouponError("");
    setSelectedCoupon(null);
    try {
      const coupons = await fetchCoupons({ q: code });
      const match = coupons.find((coupon) => coupon.code?.toUpperCase() === code.toUpperCase()) || null;
      if (!match) {
        setCouponError("Coupon not found");
        return;
      }
      setSelectedCoupon(match);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Failed to load coupon";
      setCouponError(message);
    } finally {
      setCouponLoading(false);
    }
  };

  const refreshOrder = async (orderId: string) => {
    const refreshed = await fetchOrderById(orderId);
    setOrder(refreshed);
  };

  const saveDriver = async (nextDriverId: string) => {
    if (!order || !canUpdateOrders) return;
    setDriverSaving(true);
    setDetailsError("");
    setDetailsSuccess("");
    try {
      await updateOrderDetails(order._id, {
        driverId: nextDriverId || null,
      });
      await refreshOrder(order._id);
      setDetailsSuccess(t("save") || "Saved");
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Failed to update order";
      setDetailsError(message);
      setDriverDraft(driverId);
    } finally {
      setDriverSaving(false);
    }
  };

  const saveStatus = async (nextStatus: string) => {
    if (!order || !canUpdateOrders) return;
    setStatusSaving(true);
    setDetailsError("");
    setDetailsSuccess("");
    try {
      await updateOrderStatus(order._id, nextStatus, order.paymentStatus);
      await refreshOrder(order._id);
      setDetailsSuccess(t("save") || "Saved");
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || "Failed to update order";
      setDetailsError(message);
      setStatusDraft(order.status);
    } finally {
      setStatusSaving(false);
    }
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
            <div className="stat-value">
              {canUpdateOrders ? (
                <button
                  className="onHoverEdit"
                  style={{"backgroundColor":"transparent","border":"none","padding":0}}
                  type="button"
                  onClick={() => setActivePicker("status")}
                  disabled={statusSaving}
                >
                  {statusSaving ? <div className="spinner small"></div> : <StatusPill value={statusDraft || order.status} size="big" />}
                </button>
              ) : (
                <StatusPill value={order.status} size="big" />
              )}
            </div>
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
                  {canUpdateOrders ? (
                    <button
                      className="link-btn onHoverEdit"
                      type="button"
                      onClick={() => setActivePicker("driver")}
                      disabled={driverSaving}
                    >
                      {driverSaving ? <div className="spinner small"></div> : driver?.name || driver?.email || (t("selectDriver") ?? "Select driver")}
                    </button>
                  ) : canOpenUserDetails && driverId ? (
                    <button className="link-btn" type="button" onClick={() => loadUserDetails(driverId)} disabled={userDetailsLoading === driverId}>
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
                <div className="detailsLabel">{t("deliveryAddress")}</div>
                <div className="detailsValue">{order.address}</div>
              </div>
              <div className="detailsRow">
                <div className="detailsLabel">{t("note")}</div>
                <div className="detailsValue">{order.notes || "-"}</div>
              </div>
              {detailsError && <div className="error">{detailsError}</div>}
              {detailsSuccess && <div className="success">{detailsSuccess}</div>}
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
                <div className="detailsValue">
                  {order.couponCodes?.length ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {order.couponCodes.map((code) =>
                        canViewCoupons ? (
                          <button key={code} className="link-btn" type="button" onClick={() => openCouponDetails(code)}>
                            {code}
                          </button>
                        ) : (
                          <span key={code}>{code}</span>
                        )
                      )}
                    </div>
                  ) : order.couponCode ? (
                    canViewCoupons ? (
                      <button className="link-btn" type="button" onClick={() => openCouponDetails(order.couponCode || "")}>
                        {order.couponCode}
                      </button>
                    ) : (
                      order.couponCode
                    )
                  ) : (
                    "-"
                  )}
                </div>
              </div>
              <div className="detailsRow">
                <div className="detailsLabel">{t("orders.distance")}</div>
                <div className="detailsValue">{typeof order.deliveryDistanceKm === "number" ? order.deliveryDistanceKm.toFixed(2) : "-"} {t("orders.km")}</div>
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
      {activePicker && (
        <div className="modal-backdrop" onClick={closePicker}>
          <div className="modal" style={{ width: "min(420px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                {activePicker === "status" ? t("status") : t("driver")}
              </div>
              <button className="ghost-btn" type="button" onClick={closePicker} disabled={driverSaving || statusSaving}>
                {t("close")}
              </button>
            </div>
            <div className={activePicker === 'status' ? 'list-row' : 'list'} style={activePicker === 'status' ? {"gap":"10px"} : {}}>
              {activePicker === "status" ? (
                statuses.map((status) => (
                  <button
                    key={status}
                    className="driver-picker-option"
                    style={activePicker === 'status' ? {"textAlign": 'center'} : {}}
                    type="button"
                    onClick={async () => {
                      if (status === statusDraft) {
                        closePicker();
                        return;
                      }
                      setStatusDraft(status);
                      await saveStatus(status);
                      setActivePicker(null);
                    }}
                    disabled={statusSaving}
                  >
                    {/* <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}> */}
                      <StatusPill value={status} />
                    {/* </div> */}
                  </button>
                ))
              ) : (
                <>
                  <button
                    className={`driver-picker-option${driverDraft === "" ? " active" : ""}`}
                    type="button"
                    onClick={async () => {
                      if (driverDraft === "") {
                        closePicker();
                        return;
                      }
                      setDriverDraft("");
                      await saveDriver("");
                      setActivePicker(null);
                    }}
                    disabled={driverSaving}
                  >
                    <strong className="unassignLabel">{t("unassign") ?? "Unassign driver"}</strong>
                  </button>
                  {drivers.map((item) => (
                    <button
                      key={item._id}
                      className={`driver-picker-option${driverDraft === item._id ? " active" : ""}`}
                      type="button"
                      onClick={async () => {
                        if (driverDraft === item._id) {
                          closePicker();
                          return;
                        }
                        setDriverDraft(item._id);
                        await saveDriver(item._id);
                        setActivePicker(null);
                      }}
                      disabled={driverSaving}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <strong>{item.name}</strong>
                        <span className={item.driverStatus === "BUSY" ? "driver-picker-status busy" : "driver-picker-status available"}>
                          {item.driverStatus === "BUSY" ? t("driverStatus.busy") : t("driverStatus.available")}
                        </span>
                      </div>
                      <span className="rtlFix" style={{ opacity: 0.6 }}>{item.email}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {(couponLoading || selectedCoupon || couponError) && (
        <div className="modal-backdrop" onClick={closeCoupon}>
          <div className="modal" style={{ width: "min(560px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t("discountCoupon")}</div>
              <button className="ghost-btn" type="button" onClick={closeCoupon}>
                {t("close")}
              </button>
            </div>
            {couponLoading ? (
              <div className="loader" style={{ height: 120, width: "100%" }}>
                <div className="spinner"></div>
                <div className="loaderText">{t("loading")}</div>
              </div>
            ) : couponError ? (
              <div className="error">{couponError}</div>
            ) : selectedCoupon ? (
              <div className="detailsTable">
                <div className="detailsRow">
                  <div className="detailsLabel">{t("code")}</div>
                  <div className="detailsValue">{selectedCoupon.code}</div>
                </div>
                <div className="detailsRow">
                  <div className="detailsLabel">{t("title")}</div>
                  <div className="detailsValue">{selectedCoupon.title || "-"}</div>
                </div>
                <div className="detailsRow">
                  <div className="detailsLabel">{t("description")}</div>
                  <div className="detailsValue">{selectedCoupon.description || "-"}</div>
                </div>
                <div className="detailsRow">
                  <div className="detailsLabel">{t("discount")}</div>
                  <div className="detailsValue">
                    {selectedCoupon.freeDelivery
                      ? t("freeDelivery")
                      : `${selectedCoupon.discountValue}${selectedCoupon.discountType === "PERCENT" ? "%" : ` ${t("syp").toUpperCase()}`}`}
                  </div>
                </div>
                <div className="detailsRow">
                  <div className="detailsLabel">{t("usage")}</div>
                  <div className="detailsValue">{selectedCoupon.usageType}</div>
                </div>
                <div className="detailsRow">
                  <div className="detailsLabel">{t("used")}</div>
                  <div className="detailsValue">{selectedCoupon.usedCount ?? 0}</div>
                </div>
                <div className="detailsRow">
                  <div className="detailsLabel">{t("expires")}</div>
                  <div className="detailsValue">{selectedCoupon.expiresAt ? formatDateTime(selectedCoupon.expiresAt) : "-"}</div>
                </div>
                <div className="detailsRow">
                  <div className="detailsLabel">{t("status")}</div>
                  <div className="detailsValue">{selectedCoupon.isActive ? t("active") : t("inactive")}</div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderDetailsPage;
