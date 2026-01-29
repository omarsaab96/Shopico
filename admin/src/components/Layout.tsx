import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { usePermissions } from "../hooks/usePermissions";
import { useBranch } from "../context/BranchContext";

const navItems = [
  { to: "/", key: "dashboard", label: "Dashboard", permissions: ["dashboard:view"] },
  { to: "/products", key: "products", label: "Products", permissions: ["products:view", "products:manage"] },
  { to: "/categories", key: "categories", label: "Categories", permissions: ["categories:view", "categories:manage"] },
  { to: "/orders", key: "orders", label: "Orders", permissions: ["orders:view", "orders:update"] },
  { to: "/users", key: "users", label: "Users", permissions: ["users:view", "users:manage"] },
  { to: "/wallet", key: "wallet", label: "Wallet Top-ups", permissions: ["wallet:topups:view", "wallet:manage"] },
  { to: "/announcements", key: "announcements", label: "Announcements", permissions: ["announcements:view", "announcements:manage"] },
  { to: "/coupons", key: "coupons", label: "Coupons", permissions: ["coupons:view", "coupons:manage"] },
  { to: "/branches", key: "branches", label: "Branches", permissions: ["branches:view", "branches:manage"] },
  { to: "/settings", key: "settings", label: "Settings", permissions: ["settings:view", "settings:manage"] },
  { to: "/audit", key: "audit", label: "Audit Logs", permissions: ["audit:view"] },
];

const Layout = () => {
  const { user, logout } = useAuth();
  const { canAny } = usePermissions();
  const navigate = useNavigate();
  const { t, toggleLanguage, lang } = useI18n();
  const { branches, selectedBranchId, setSelectedBranchId, selectedBranch } = useBranch();
  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const [theme, setTheme] = useState<"light" | "dark">(
    (localStorage.getItem("theme") as "light" | "dark") || "light"
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brandLogo">
          <img src="shopico_logo.png" alt="" />
        </div>
        <nav>
          {navItems
            .filter((item) => canAny(...item.permissions))
            .map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>
                {t(`nav.${item.key}`) || item.label}
              </NavLink>
            ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-block">
            <div className="avatar">{user?.name?.[0] || "A"}</div>
            <div>
              <div className="user-name">{user?.name}</div>
              <div className="user-role">{user?.role}</div>
            </div>
          </div>
          <button className="ghost-btn soft" onClick={handleLogout}>
            {t("logout")}
          </button>
        </div>
      </aside>
      <main className="content">
        <header className="topbar">
          {/* <Link to="/" className="muted">
            Home
          </Link> */}
          <div className="brand">
            {/* <div className="brand-dot" /> */}
            <div>
              <div className="brand-title">
                {t("shopicoAdminPanel")}
                {selectedBranch ? ` • ${selectedBranch.name}` : ""}
              </div>
              {/* <div className="brand-sub">Admin</div> */}
            </div>
          </div>
          {/* <div className="pill">Orange Pulse</div> */}
          <div className="flex">
            {branches.length > 1 && selectedBranchId && (
              <select
                className="filter-select"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
              >
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            )}
            <button className="ghost-btn dark icon" type="button" onClick={toggleTheme}>
              <img src="themeIcon.png" alt="" />
            </button>
            <button className="ghost-btn dark icon" type="button" onClick={toggleLanguage}>
              {lang === "en" ? "ع" : "EN"}
            </button>
          </div>
        </header>
        <div className="page">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
