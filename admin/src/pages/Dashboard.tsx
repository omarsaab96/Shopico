import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Card from "../components/Card";
import { fetchAnnouncements, fetchCoupons, fetchOrders, fetchProductsAdmin, fetchTopUps, fetchUsers } from "../api/client";
import type { Order } from "../types/api";
import StatusPill from "../components/StatusPill";
import { usePermissions } from "../hooks/usePermissions";
import { useBranch } from "../context/BranchContext";

const DashboardPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [productsTotal, setProductsTotal] = useState(0);
  const [pendingTopups, setPendingTopups] = useState(0);
  const [usersTotal, setUsersTotal] = useState(0);
  const [announcementsTotal, setAnnouncementsTotal] = useState(0);
  const [couponsTotal, setCouponsTotal] = useState(0);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingTopups, setLoadingTopups] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const { can } = usePermissions();
  const { selectedBranchId } = useBranch();
  const canViewOrders = can("orders:view");
  const canViewProducts = can("products:view");
  const canViewWallet = can("wallet:topups:view") || can("wallet:manage");
  const canViewUsers = can("users:view");
  const canViewAnnouncements = can("announcements:view");
  const canViewCoupons = can("coupons:view");
  const lockedMetricValue = "******";
  const lockedMetricSub = "\uD83D\uDD12 Restricted access";

  useEffect(() => {
    if (!selectedBranchId) return;
    if (canViewOrders) {
      setLoadingOrders(true);
      fetchOrders()
        .then(setOrders)
        .catch(console.error)
        .finally(() => setLoadingOrders(false));
    } else {
      setOrders([]);
      setLoadingOrders(false);
    }
    if (canViewProducts) {
      setLoadingProducts(true);
      fetchProductsAdmin({ page: 1, limit: 1, includeUnavailable: true })
        .then((data) => setProductsTotal(data.total))
        .catch(console.error)
        .finally(() => setLoadingProducts(false));
    } else {
      setProductsTotal(0);
      setLoadingProducts(false);
    }
    if (canViewWallet) {
      setLoadingTopups(true);
      fetchTopUps({ status: "PENDING" })
        .then((data) => setPendingTopups(data.length))
        .catch(console.error)
        .finally(() => setLoadingTopups(false));
    } else {
      setPendingTopups(0);
      setLoadingTopups(false);
    }
    if (canViewUsers) {
      setLoadingUsers(true);
      fetchUsers()
        .then((data) => setUsersTotal(data.length))
        .catch(console.error)
        .finally(() => setLoadingUsers(false));
    } else {
      setUsersTotal(0);
      setLoadingUsers(false);
    }
    if (canViewAnnouncements) {
      setLoadingAnnouncements(true);
      fetchAnnouncements()
        .then((data) => setAnnouncementsTotal(data.length))
        .catch(console.error)
        .finally(() => setLoadingAnnouncements(false));
    } else {
      setAnnouncementsTotal(0);
      setLoadingAnnouncements(false);
    }
    if (canViewCoupons) {
      setLoadingCoupons(true);
      fetchCoupons()
        .then((data) => setCouponsTotal(data.length))
        .catch(console.error)
        .finally(() => setLoadingCoupons(false));
    } else {
      setCouponsTotal(0);
      setLoadingCoupons(false);
    }
  }, [
    canViewOrders,
    canViewProducts,
    canViewWallet,
    canViewUsers,
    canViewAnnouncements,
    canViewCoupons,
    selectedBranchId,
  ]);

  const revenue = canViewOrders ? orders.reduce((sum, o) => sum + o.total, 0) : 0;
  const pending = canViewOrders
    ? orders.filter((o) => o.status !== "DELIVERED" && o.status !== "CANCELLED").length
    : 0;
  const readableDateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });

  const { revenueSeries, orderCountSeries, labels, rangeLabel } = useMemo(() => {
    const days = 7;
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(base);
    start.setDate(start.getDate() - (days - 1));
    const labels = Array.from({ length: days }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() - (days - 1 - i));
      return readableDateFormatter.format(d);
    });
    const buckets = Array.from({ length: days }, () => ({ revenue: 0, count: 0 }));
    orders.forEach((order) => {
      if (!order.createdAt) return;
      const date = new Date(order.createdAt);
      const orderDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const diffDays = Math.floor((orderDay.getTime() - base.getTime()) / (24 * 60 * 60 * 1000));
      const idx = days - 1 + diffDays;
      if (idx >= 0 && idx < days) {
        buckets[idx].revenue += order.total || 0;
        buckets[idx].count += 1;
      }
    });
    return {
      labels,
      rangeLabel: `${readableDateFormatter.format(start)} - ${readableDateFormatter.format(base)}`,
      revenueSeries: buckets.map((b) => b.revenue),
      orderCountSeries: buckets.map((b) => b.count),
    };
  }, [orders, readableDateFormatter]);

  const renderSpark = (series: number[], color: string) => {
    const max = Math.max(...series, 1);
    const min = Math.min(...series, 0);
    const range = Math.max(1, max - min);
    const points = series.map((v, i) => {
      const x = (i / (series.length - 1 || 1)) * 100;
      const y = 100 - ((v - min) / range) * 100;
      return `${x},${y}`;
    });
    const path = `M ${points.join(" L ")}`;
    const area = `${path} L 100,100 L 0,100 Z`;
    return (
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="chart-svg">
        <path d={area} fill={`${color}22`} />
        <path d={path} fill="none" stroke={color} strokeWidth="2" />
      </svg>
    );
  };

  return (
    <div className="dashboard-grid">
      <Card title="Store Pulse" subTitle="">
        <div className="kpi-grid">
          <div className="kpi-card accent">
            <div className="kpi-label">Revenue (SYP)</div>
            <div className="kpi-value">
              {!canViewOrders ? lockedMetricValue : loadingOrders ? <span className="skeleton-line w-140" /> : revenue.toLocaleString()}
            </div>
            <div className="kpi-sub">{!canViewOrders ? lockedMetricSub : rangeLabel}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Open Orders</div>
            <div className="kpi-value">
              {!canViewOrders ? lockedMetricValue : loadingOrders ? <span className="skeleton-line w-80" /> : pending}
            </div>
            <div className="kpi-sub">{!canViewOrders ? lockedMetricSub : "Needs attention"}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Products</div>
            <div className="kpi-value">
              {!canViewProducts ? lockedMetricValue : loadingProducts ? <span className="skeleton-line w-100" /> : productsTotal.toLocaleString()}
            </div>
            <div className="kpi-sub">{!canViewProducts ? lockedMetricSub : "Active catalog"}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Pending Top-ups</div>
            <div className="kpi-value">
              {!canViewWallet ? lockedMetricValue : loadingTopups ? <span className="skeleton-line w-80" /> : pendingTopups}
            </div>
            <div className="kpi-sub">{!canViewWallet ? lockedMetricSub : "Awaiting approval"}</div>
          </div>
        </div>
      </Card>

      <div className="dashboard-row">
        <Card title="Weekly Revenue" subTitle="">
          <div className="chart-card">
            <div className="chart-meta">
              <div className="chart-title">7-day trend</div>
              <div className="chart-value">
                {!canViewOrders ? lockedMetricValue : loadingOrders ? <span className="skeleton-line w-120" /> : `${revenue.toLocaleString()} SYP`}
              </div>
            </div>
            <div className="chart-wrap">
              {!canViewOrders ? (
                <div className="chart-locked">{lockedMetricSub}</div>
              ) : loadingOrders ? (
                <div className="skeleton-block" />
              ) : (
                renderSpark(revenueSeries, "var(--accent)")
              )}
            </div>
            {!canViewOrders ? (
              <div className="chart-locked-sub">{lockedMetricSub}</div>
            ) : (
              <>
                <div className="chart-labels">
                  {labels.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
                <div className="chart-actions">
                  <Link to="/orders" className="ghost-btn">View more</Link>
                </div>
              </>
            )}
          </div>
        </Card>

        <Card title="Order Volume" subTitle="">
          <div className="chart-card">
            <div className="chart-meta">
              <div className="chart-title">Orders per day</div>
              <div className="chart-value">
                {!canViewOrders ? lockedMetricValue : loadingOrders ? <span className="skeleton-line w-80" /> : orders.length.toLocaleString()}
              </div>
            </div>
            <div className="chart-wrap">
              {!canViewOrders ? (
                <div className="chart-locked">{lockedMetricSub}</div>
              ) : loadingOrders ? (
                <div className="skeleton-block" />
              ) : (
                renderSpark(orderCountSeries, "#16a34a")
              )}
            </div>
            {!canViewOrders ? (
              <div className="chart-locked-sub">{lockedMetricSub}</div>
            ) : (
              <>
                <div className="chart-labels">
                  {labels.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
                <div className="chart-actions">
                  <Link to="/orders" className="ghost-btn">View more</Link>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      <Card title="Recent Orders" subTitle="">
        {canViewOrders && (
          <div className="card-actions">
            <Link to="/orders" className="ghost-btn">View more</Link>
          </div>
        )}
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
                <td>{lockedMetricValue}</td>
                <td>{lockedMetricValue}</td>
                <td className="muted">{lockedMetricSub}</td>
                <td>{lockedMetricValue}</td>
              </tr>
            ) : loadingOrders ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`}>
                  <td><span className="skeleton-line w-60" /></td>
                  <td><span className="skeleton-line w-140" /></td>
                  <td><span className="skeleton-line w-100" /></td>
                  <td><span className="skeleton-line w-80" /></td>
                </tr>
              ))
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

      <Card title="Quick View" subTitle="">
        <div className="quick-grid">
          <div className="quick-card">
            <div className="quick-title">Products</div>
            <div className="quick-value">
              {!canViewProducts ? lockedMetricValue : loadingProducts ? <span className="skeleton-line w-100" /> : productsTotal.toLocaleString()}
            </div>
            {canViewProducts ? <Link to="/products" className="ghost-btn text-center">View more</Link> : <div className="kpi-sub">{lockedMetricSub}</div>}
          </div>
          <div className="quick-card">
            <div className="quick-title">Orders</div>
            <div className="quick-value">
              {!canViewOrders ? lockedMetricValue : loadingOrders ? <span className="skeleton-line w-80" /> : orders.length.toLocaleString()}
            </div>
            {canViewOrders ? <Link to="/orders" className="ghost-btn text-center">View more</Link> : <div className="kpi-sub">{lockedMetricSub}</div>}
          </div>
          <div className="quick-card">
            <div className="quick-title">Wallet Top-ups</div>
            <div className="quick-value">
              {!canViewWallet ? lockedMetricValue : loadingTopups ? <span className="skeleton-line w-60" /> : pendingTopups}
            </div>
            {canViewWallet ? <Link to="/wallet" className="ghost-btn text-center">View more</Link> : <div className="kpi-sub">{lockedMetricSub}</div>}
          </div>
          <div className="quick-card">
            <div className="quick-title">Coupons</div>
            <div className="quick-value">
              {!canViewCoupons ? lockedMetricValue : loadingCoupons ? <span className="skeleton-line w-60" /> : couponsTotal.toLocaleString()}
            </div>
            {canViewCoupons ? <Link to="/coupons" className="ghost-btn text-center">View more</Link> : <div className="kpi-sub">{lockedMetricSub}</div>}
          </div>
          <div className="quick-card">
            <div className="quick-title">Announcements</div>
            <div className="quick-value">
              {!canViewAnnouncements ? lockedMetricValue : loadingAnnouncements ? <span className="skeleton-line w-60" /> : announcementsTotal.toLocaleString()}
            </div>
            {canViewAnnouncements ? <Link to="/announcements" className="ghost-btn text-center">View more</Link> : <div className="kpi-sub">{lockedMetricSub}</div>}
          </div>
          <div className="quick-card">
            <div className="quick-title">Users</div>
            <div className="quick-value">
              {!canViewUsers ? lockedMetricValue : loadingUsers ? <span className="skeleton-line w-60" /> : usersTotal.toLocaleString()}
            </div>
            {canViewUsers ? <Link to="/users" className="ghost-btn text-center">View more</Link> : <div className="kpi-sub">{lockedMetricSub}</div>}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default DashboardPage;
