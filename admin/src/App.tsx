import { Suspense, lazy, type ReactElement } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { useAuth } from "./context/AuthContext";
import { useI18n } from "./context/I18nContext";
import RequirePermission from "./components/RequirePermission";
import RequireBranch from "./components/RequireBranch";

const LoginPage = lazy(() => import("./pages/Login"));
const DashboardPage = lazy(() => import("./pages/Dashboard"));
const ProductsPage = lazy(() => import("./pages/Products"));
const CategoriesPage = lazy(() => import("./pages/Categories"));
const OrdersPage = lazy(() => import("./pages/Orders"));
const OrderDetailsPage = lazy(() => import("./pages/OrderDetails"));
const UsersPage = lazy(() => import("./pages/Users"));
const WalletPage = lazy(() => import("./pages/Wallet"));
const AnnouncementsPage = lazy(() => import("./pages/Announcements"));
const CouponsPage = lazy(() => import("./pages/Coupons"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const AuditLogsPage = lazy(() => import("./pages/AuditLogs"));
const BranchesPage = lazy(() => import("./pages/Branches"));

const Protected = ({ children }: { children: ReactElement }) => {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  if (loading) return <div className="loader"><div className="spinner"></div><div className="loaderText">{t("loading")}</div></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const RouteLoader = () => {
  const { t } = useI18n();
  return (
    <div className="loader">
      <div className="spinner"></div>
      <div className="loaderText">{t("loading")}</div>
    </div>
  );
};

const BranchScoped = ({ children }: { children: ReactElement }) => (
  <RequireBranch>{children}</RequireBranch>
);

const App = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <Protected>
                <Layout />
              </Protected>
            }
          >
            <Route
              index
              element={
                <RequirePermission anyOf={["dashboard:view"]}>
                  <BranchScoped>
                    <DashboardPage />
                  </BranchScoped>
                </RequirePermission>
              }
            />
            <Route
              path="products"
              element={
                <RequirePermission anyOf={["products:view"]}>
                  <BranchScoped>
                    <ProductsPage />
                  </BranchScoped>
                </RequirePermission>
              }
            />
            <Route
              path="categories"
              element={
                <RequirePermission anyOf={["categories:view"]}>
                  <BranchScoped>
                    <CategoriesPage />
                  </BranchScoped>
                </RequirePermission>
              }
            />
            <Route
              path="orders"
              element={
                <RequirePermission anyOf={["orders:view"]}>
                  <BranchScoped>
                    <OrdersPage />
                  </BranchScoped>
                </RequirePermission>
              }
            />
            <Route
              path="orders/:id"
              element={
                <RequirePermission anyOf={["orders:view"]}>
                  <BranchScoped>
                    <OrderDetailsPage />
                  </BranchScoped>
                </RequirePermission>
              }
            />
            <Route
              path="users"
              element={
                <RequirePermission anyOf={["users:view"]}>
                  <BranchScoped>
                    <UsersPage />
                  </BranchScoped>
                </RequirePermission>
              }
            />
            <Route
              path="wallet"
              element={
                <RequirePermission anyOf={["wallet:topups:view"]}>
                  <BranchScoped>
                    <WalletPage />
                  </BranchScoped>
                </RequirePermission>
              }
            />
            <Route
              path="announcements"
              element={
                <RequirePermission anyOf={["announcements:view"]}>
                  <BranchScoped>
                    <AnnouncementsPage />
                  </BranchScoped>
                </RequirePermission>
              }
            />
            <Route
              path="coupons"
              element={
                <RequirePermission anyOf={["coupons:view"]}>
                  <BranchScoped>
                    <CouponsPage />
                  </BranchScoped>
                </RequirePermission>
              }
            />
            <Route
              path="settings"
              element={
                <RequirePermission anyOf={["settings:view"]}>
                  <BranchScoped>
                    <SettingsPage />
                  </BranchScoped>
                </RequirePermission>
              }
            />
            <Route
              path="branches"
              element={
                <RequirePermission anyOf={["branches:view"]}>
                  <BranchesPage />
                </RequirePermission>
              }
            />
            <Route
              path="audit"
              element={
                <RequirePermission anyOf={["audit:view"]}>
                  <AuditLogsPage />
                </RequirePermission>
              }
            />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
