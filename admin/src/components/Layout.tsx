import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/products", label: "Products" },
  { to: "/categories", label: "Categories" },
  { to: "/orders", label: "Orders" },
  { to: "/users", label: "Users" },
  { to: "/wallet", label: "Wallet Top-ups" },
  { to: "/settings", label: "Settings" },
  { to: "/audit", label: "Audit Logs" },
];

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => {
    logout();
    navigate("/login");
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-dot" />
          <div>
            <div className="brand-title">Shopico</div>
            <div className="brand-sub">Admin</div>
          </div>
        </div>
        <nav>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>
              {item.label}
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
            Logout
          </button>
        </div>
      </aside>
      <main className="content">
        <header className="topbar">
          <Link to="/" className="muted">
            {/* Home */}
          </Link>
          <div className="pill">Orange Pulse</div>
        </header>
        <div className="page">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
