import { createContext, useContext, useEffect, useState } from "react";
import api, { clearTokens, storeTokens } from "./api";

interface AuthContextValue {
  user?: any;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<any>;
  setUserProfile: (user: any) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>();
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const res = await api.get("/auth/me");
    const profile = res.data.data.user;
    setUser(profile);
    return profile;
  };

  useEffect(() => {
    refreshUser()
      .catch(() => setUser(undefined))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    const { accessToken, refreshToken, user: profile } = res.data.data;
    await storeTokens(accessToken, refreshToken);
    setUser(profile);
  };

  const logout = async () => {
    await clearTokens();
    setUser(undefined);
  };

  return <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, setUserProfile: setUser }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
