import { createContext, useContext, useEffect, useRef, useState } from "react";
import { fetchProfile, login as apiLogin } from "../api/client";
import type { AuthResponse } from "../api/client";
import type { ApiUser } from "../types/api";
import SessionExpiry from "../components/SessionExpiry";

interface AuthContextValue {
  user?: ApiUser;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<ApiUser | undefined>();
  const [loading, setLoading] = useState(true);
  const authEpoch = useRef(0);

  useEffect(() => {
    const bootstrap = async () => {
      const epoch = authEpoch.current;
      try {
        const profile = await fetchProfile();
        if (epoch === authEpoch.current) setUser(profile);
      } catch {
        if (epoch === authEpoch.current) setUser(undefined);
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, []);

  const refreshProfile = async () => {
    const epoch = authEpoch.current;
    try {
      const profile = await fetchProfile();
      if (epoch === authEpoch.current) setUser(profile);
    } catch {
      if (epoch === authEpoch.current) setUser(undefined);
    }
  };

  const login = async (email: string, password: string) => {
    const epoch = ++authEpoch.current;
    const res: AuthResponse = await apiLogin(email, password);
    if (epoch !== authEpoch.current) throw new Error("Session changed");
    localStorage.setItem("accessToken", res.accessToken);
    setUser(res.user);
  };

  const logout = () => {
    authEpoch.current += 1;
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setUser(undefined);
  };

  return <AuthContext.Provider value={{ user, loading, login, logout, refreshProfile }}>{children}<SessionExpiry /></AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
