import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";

const navItems = [
  { to: "/", key: "dashboard", label: "Dashboard" },
  { to: "/products", key: "products", label: "Products" },
  { to: "/categories", key: "categories", label: "Categories" },
  { to: "/orders", key: "orders", label: "Orders" },
  { to: "/users", key: "users", label: "Users" },
  { to: "/wallet", key: "wallet", label: "Wallet Top-ups" },
  { to: "/settings", key: "settings", label: "Settings" },
  { to: "/audit", key: "audit", label: "Audit Logs" },
];

const Layout = () => {
  const { user, logout } = useAuth();
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
          {navItems.map((item) => (
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
