import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      console.error(err);
      setError("Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-grid">
      <div className="auth-hero">
        <div className="grad" />
        <div>
          <p className="pill">Shopico Ops</p>
          <h1>Fresh control for your grocery fleet.</h1>
          <p className="muted">
            Manage products, verify payments, and oversee deliveries in one orange-forward cockpit.
          </p>
          <div className="bullet">ImageKit uploads, wallet approvals, delivery fees, points and membership control.</div>
        </div>
      </div>
      <div className="auth-card">
        <h2>Login to Admin</h2>
        <p className="muted">Use the seeded admin credentials or your own account.</p>
        <form onSubmit={onSubmit} className="form">
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="admin@shopico.local" />
          </label>
          <label>
            Password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="********"
            />
          </label>
          {error && <div className="error">{error}</div>}
          <button className="primary" disabled={loading}>
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
