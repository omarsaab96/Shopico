import type { ReactElement } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import LoginPage from "./pages/Login";
import DashboardPage from "./pages/Dashboard";
import ProductsPage from "./pages/Products";
import CategoriesPage from "./pages/Categories";
import OrdersPage from "./pages/Orders";
import UsersPage from "./pages/Users";
import WalletPage from "./pages/Wallet";
import AnnouncementsPage from "./pages/Announcements";
import CouponsPage from "./pages/Coupons";
import SettingsPage from "./pages/Settings";
import AuditLogsPage from "./pages/AuditLogs";
import BranchesPage from "./pages/Branches";
import { useAuth } from "./context/AuthContext";
import RequirePermission from "./components/RequirePermission";

const Protected = ({ children }: { children: ReactElement }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loader"><div className="spinner"></div><div className="loaderText">Loading...</div></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const App = () => {
  return (
    <BrowserRouter>
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
                <DashboardPage />
              </RequirePermission>
            }
          />
          <Route
            path="products"
            element={
              <RequirePermission anyOf={["products:view", "products:manage"]}>
                <ProductsPage />
              </RequirePermission>
            }
          />
          <Route
            path="categories"
            element={
              <RequirePermission anyOf={["categories:view", "categories:manage"]}>
                <CategoriesPage />
              </RequirePermission>
            }
          />
          <Route
            path="orders"
            element={
              <RequirePermission anyOf={["orders:view", "orders:update"]}>
                <OrdersPage />
              </RequirePermission>
            }
          />
          <Route
            path="users"
            element={
              <RequirePermission anyOf={["users:view", "users:manage"]}>
                <UsersPage />
              </RequirePermission>
            }
          />
          <Route
            path="wallet"
            element={
              <RequirePermission anyOf={["wallet:topups:view", "wallet:manage"]}>
                <WalletPage />
              </RequirePermission>
            }
          />
          <Route
            path="announcements"
            element={
              <RequirePermission anyOf={["announcements:view", "announcements:manage"]}>
                <AnnouncementsPage />
              </RequirePermission>
            }
          />
          <Route
            path="coupons"
            element={
              <RequirePermission anyOf={["coupons:view", "coupons:manage"]}>
                <CouponsPage />
              </RequirePermission>
            }
          />
          <Route
            path="settings"
            element={
              <RequirePermission anyOf={["settings:view", "settings:manage"]}>
                <SettingsPage />
              </RequirePermission>
            }
          />
          <Route
            path="branches"
            element={
              <RequirePermission anyOf={["branches:view", "branches:manage"]}>
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
    </BrowserRouter>
  );
};

export default App;
