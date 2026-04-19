import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "../components/Card";
import { fetchAnnouncements, fetchCoupons, fetchOrders, fetchProductsAdmin, fetchTopUps, fetchUsers } from "../api/client";
import { useI18n } from "../context/I18nContext";
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
  const { t, dir } = useI18n();
  const { can } = usePermissions();
  const { selectedBranchId } = useBranch();
  const canViewOrders = can("orders:view");
  const canViewProducts = can("products:view");
  const canViewWallet = can("wallet:topups:view") || can("wallet:manage");
  const canViewUsers = can("users:view");
  const canViewAnnouncements = can("announcements:view");
  const canViewCoupons = can("coupons:view");
  const lockedMetricValue = "******";
  const lockedMetricSub = `\uD83D\uDD12 ${t("dashboard.restrictedAccess")}`;
  const formatTooltipNumber = (value: unknown) =>
    typeof value === "number" ? value.toLocaleString() : String(value ?? "");

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

  const totalRevenue = canViewOrders ? orders.reduce((sum, o) => sum + o.total, 0) : 0;
  const pending = canViewOrders
    ? orders.filter((o) => o.status !== "DELIVERED" && o.status !== "CANCELLED").length
    : 0;
  const readableDateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });

  const { chartData, rangeLabel, weeklyRevenue, weeklyOrderCount } = useMemo(() => {
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
      rangeLabel: `${readableDateFormatter.format(start)} - ${readableDateFormatter.format(base)}`,
      chartData: buckets.map((bucket, index) => ({
        label: labels[index],
        revenue: bucket.revenue,
        orders: bucket.count,
      })),
      weeklyRevenue: buckets.reduce((sum, bucket) => sum + bucket.revenue, 0),
      weeklyOrderCount: buckets.reduce((sum, bucket) => sum + bucket.count, 0),
    };
  }, [orders, readableDateFormatter]);
  const chartMargin = { top: 10, right: 8, left: 8, bottom: 0 };

  return (
    <div className="dashboard-grid">
      <Card title={t("dashboard.storePulse")} subTitle="">
        <div className="kpi-grid">
          <div className="kpi-card accent">
            <div className="kpi-label">{t("dashboard.revenueSyp")}</div>
            <div className="kpi-value">
              {!canViewOrders ? lockedMetricValue : loadingOrders ? <span className="skeleton-line w-140" /> : totalRevenue.toLocaleString()}
            </div>
            <div className="kpi-sub">{!canViewOrders ? lockedMetricSub : rangeLabel}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">{t("dashboard.openOrders")}</div>
            <div className="kpi-value">
              {!canViewOrders ? lockedMetricValue : loadingOrders ? <span className="skeleton-line w-80" /> : pending}
            </div>
            <div className="kpi-sub">{!canViewOrders ? lockedMetricSub : t("dashboard.needsAttention")}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">{t("dashboard.products")}</div>
            <div className="kpi-value">
              {!canViewProducts ? lockedMetricValue : loadingProducts ? <span className="skeleton-line w-100" /> : productsTotal.toLocaleString()}
            </div>
            <div className="kpi-sub">{!canViewProducts ? lockedMetricSub : t("dashboard.activeCatalog")}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">{t("dashboard.pendingTopups")}</div>
            <div className="kpi-value">
              {!canViewWallet ? lockedMetricValue : loadingTopups ? <span className="skeleton-line w-80" /> : pendingTopups}
            </div>
            <div className="kpi-sub">{!canViewWallet ? lockedMetricSub : t("dashboard.awaitingApproval")}</div>
          </div>
        </div>
      </Card>

      <div className="dashboard-row">
        <Card title={t("dashboard.weeklyRevenue")} subTitle="">
          <div className="chart-card">
            <div className="chart-meta">
              <div className="chart-title">{t("dashboard.sevenDayTrend")}</div>
              <div className="chart-value">
                {!canViewOrders ? lockedMetricValue : loadingOrders ? <span className="skeleton-line w-120" /> : `${weeklyRevenue.toLocaleString()} ${t("syp").toUpperCase()}`}
              </div>
            </div>
            <div className="chart-wrap" dir="ltr">
              {!canViewOrders ? (
                <div className="chart-locked">{lockedMetricSub}</div>
              ) : loadingOrders ? (
                <div className="skeleton-block" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={chartMargin}>
                    <defs>
                      <linearGradient id="dashboardRevenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#111827" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#111827" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--gray-300)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} reversed={dir === "rtl"} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={52}
                      orientation={dir === "rtl" ? "right" : "left"}
                      mirror={false}
                      tickMargin={8}
                    />
                    <Tooltip
                      cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                      contentStyle={{ borderRadius: 12, border: "1px solid var(--gray-300)" }}
                      wrapperStyle={{ direction: dir }}
                      formatter={(value) => [`${formatTooltipNumber(value)} SYP`, t("dashboard.revenueSyp")]}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#111827"
                      strokeWidth={2.5}
                      fill="url(#dashboardRevenueFill)"
                    />
                    <Line type="monotone" dataKey="revenue" stroke="#111827" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            {!canViewOrders ? (
              <div className="chart-locked-sub">{lockedMetricSub}</div>
            ) : (
              <>
                <div className="chart-actions">
                  <Link to="/orders" className="ghost-btn">{t("dashboard.viewMore")}</Link>
                </div>
              </>
            )}
          </div>
        </Card>

        <Card title={t("dashboard.orderVolume")} subTitle="">
          <div className="chart-card">
            <div className="chart-meta">
              <div className="chart-title">{t("dashboard.ordersPerDay")}</div>
              <div className="chart-value">
                {!canViewOrders ? lockedMetricValue : loadingOrders ? <span className="skeleton-line w-80" /> : weeklyOrderCount.toLocaleString()}
              </div>
            </div>
            <div className="chart-wrap" dir="ltr">
              {!canViewOrders ? (
                <div className="chart-locked">{lockedMetricSub}</div>
              ) : loadingOrders ? (
                <div className="skeleton-block" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={chartMargin} barCategoryGap="28%">
                    <CartesianGrid stroke="var(--gray-300)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} reversed={dir === "rtl"} />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      width={40}
                      orientation={dir === "rtl" ? "right" : "left"}
                      mirror={false}
                      tickMargin={8}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
                      contentStyle={{ borderRadius: 12, border: "1px solid var(--gray-300)" }}
                      wrapperStyle={{ direction: dir }}
                      formatter={(value) => [formatTooltipNumber(value), t("titles.orders")]}
                    />
                    <Bar dataKey="orders" fill="#111827" radius={[10, 10, 4, 4]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            {!canViewOrders ? (
              <div className="chart-locked-sub">{lockedMetricSub}</div>
            ) : (
              <>
                <div className="chart-actions">
                  <Link to="/orders" className="ghost-btn">{t("dashboard.viewMore")}</Link>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      <Card title={t("dashboard.recentOrders")} subTitle="">
        {canViewOrders && (
          <div className="card-actions">
            <Link to="/orders" className="ghost-btn">{t("dashboard.viewMore")}</Link>
          </div>
        )}
        <table className="table">
          <thead>
            <tr>
              <th>{t("titles.orders")}</th>
              <th>{t("customer")}</th>
              <th>{t("status")}</th>
              <th>{t("total")}</th>
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
                <td colSpan={6} className="muted">{t("dashboard.noOrders")}</td>
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

      <Card title={t("dashboard.quickView")} subTitle="">
        <div className="quick-grid">
          <div className="quick-card">
            <div className="quick-title">{t("dashboard.products")}</div>
            <div className="quick-value">
              {!canViewProducts ? lockedMetricValue : loadingProducts ? <span className="skeleton-line w-100" /> : productsTotal.toLocaleString()}
            </div>
            {canViewProducts ? <Link to="/products" className="ghost-btn text-center">{t("dashboard.viewMore")}</Link> : <div className="kpi-sub">{lockedMetricSub}</div>}
          </div>
          <div className="quick-card">
            <div className="quick-title">{t("titles.orders")}</div>
            <div className="quick-value">
              {!canViewOrders ? lockedMetricValue : loadingOrders ? <span className="skeleton-line w-80" /> : orders.length.toLocaleString()}
            </div>
            {canViewOrders ? <Link to="/orders" className="ghost-btn text-center">{t("dashboard.viewMore")}</Link> : <div className="kpi-sub">{lockedMetricSub}</div>}
          </div>
          <div className="quick-card">
            <div className="quick-title">{t("dashboard.walletTopups")}</div>
            <div className="quick-value">
              {!canViewWallet ? lockedMetricValue : loadingTopups ? <span className="skeleton-line w-60" /> : pendingTopups}
            </div>
            {canViewWallet ? <Link to="/wallet" className="ghost-btn text-center">{t("dashboard.viewMore")}</Link> : <div className="kpi-sub">{lockedMetricSub}</div>}
          </div>
          <div className="quick-card">
            <div className="quick-title">{t("nav.coupons")}</div>
            <div className="quick-value">
              {!canViewCoupons ? lockedMetricValue : loadingCoupons ? <span className="skeleton-line w-60" /> : couponsTotal.toLocaleString()}
            </div>
            {canViewCoupons ? <Link to="/coupons" className="ghost-btn text-center">{t("dashboard.viewMore")}</Link> : <div className="kpi-sub">{lockedMetricSub}</div>}
          </div>
          <div className="quick-card">
            <div className="quick-title">{t("dashboard.announcements")}</div>
            <div className="quick-value">
              {!canViewAnnouncements ? lockedMetricValue : loadingAnnouncements ? <span className="skeleton-line w-60" /> : announcementsTotal.toLocaleString()}
            </div>
            {canViewAnnouncements ? <Link to="/announcements" className="ghost-btn text-center">{t("dashboard.viewMore")}</Link> : <div className="kpi-sub">{lockedMetricSub}</div>}
          </div>
          <div className="quick-card">
            <div className="quick-title">{t("dashboard.users")}</div>
            <div className="quick-value">
              {!canViewUsers ? lockedMetricValue : loadingUsers ? <span className="skeleton-line w-60" /> : usersTotal.toLocaleString()}
            </div>
            {canViewUsers ? <Link to="/users" className="ghost-btn text-center">{t("dashboard.viewMore")}</Link> : <div className="kpi-sub">{lockedMetricSub}</div>}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default DashboardPage;
