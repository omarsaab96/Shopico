import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { usePermissions } from "../hooks/usePermissions";

const navItems = [
  { to: "/", key: "dashboard", label: "Dashboard", permissions: ["dashboard:view"] },
  { to: "/products", key: "products", label: "Products", permissions: ["products:view", "products:manage"] },
  { to: "/categories", key: "categories", label: "Categories", permissions: ["categories:view", "categories:manage"] },
  { to: "/orders", key: "orders", label: "Orders", permissions: ["orders:view", "orders:update"] },
  { to: "/users", key: "users", label: "Users", permissions: ["users:view", "users:manage"] },
  { to: "/wallet", key: "wallet", label: "Wallet Top-ups", permissions: ["wallet:view", "wallet:manage"] },
  { to: "/announcements", key: "announcements", label: "Announcements", permissions: ["announcements:view", "announcements:manage"] },
  { to: "/coupons", key: "coupons", label: "Coupons", permissions: ["coupons:view", "coupons:manage"] },
  { to: "/settings", key: "settings", label: "Settings", permissions: ["settings:view", "settings:manage"] },
  { to: "/audit", key: "audit", label: "Audit Logs", permissions: ["audit:view"] },
];

const Layout = () => {
  const { user, logout } = useAuth();
  const { canAny } = usePermissions();
  const navigate = useNavigate();
  const { t, toggleLanguage, lang } = useI18n();
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
              <div className="brand-title">{t("shopicoAdminPanel")}</div>
              {/* <div className="brand-sub">Admin</div> */}
            </div>
          </div>
          {/* <div className="pill">Orange Pulse</div> */}
          <div className="flex">
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
