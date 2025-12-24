import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { useEffect, useState as useStateReact } from "react";

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t, toggleLanguage, lang } = useI18n();
  const [theme, setTheme] = useStateReact<"light" | "dark">(
    (localStorage.getItem("theme") as "light" | "dark") || "light"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      console.error(err);
      setError(t("invalidCredentials"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-grid">
      <div className="top-right-actions" style={{ position:'absolute', width:'100%', display: "flex", justifyContent: "flex-end", gap: 16, padding:'20px 28px' }}>
        <button className="ghost-btn dark icon" type="button" onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}>
          <img src="themeIcon.png" alt="" />
        </button>
        <button className="ghost-btn dark icon" type="button" onClick={toggleLanguage}>
          {lang === "en" ? "ع" : "EN"}
        </button>
      </div>
      {/* <div className="auth-hero">
        <div className="grad" />
        <div>
          <p className="pill">Shopico Ops</p>
          <h1>{t("nav.dashboard")}</h1>
          <p className="muted">{t("loginSubtitle")}</p>
          <div className="bullet">ImageKit uploads, wallet approvals, delivery fees, points and membership control.</div>
        </div>
      </div> */}
      <div className="auth-card">

        <div className="brandLogo" style={{ margin: '0 auto', width: 200 }}>
          <img src={theme === "dark" ? "shopico_logo.png" : "shopico_logo-black.png"} alt="" />
        </div>
        <h2>{t("loginTitle")}</h2>
        {/* <p className="muted">{t("loginSubtitle")}</p> */}
        <form onSubmit={onSubmit} className="form">
          <label>
            {t("emailLabel")}
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="admin@shopico.local" />
          </label>
          <label>
            {t("passwordLabel")}
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="********"
            />
          </label>
          {error && <div className="error">{error}</div>}
          <button className="primary" disabled={loading}>
            {loading ? t("signingIn") : t("loginButton")}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
