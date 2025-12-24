import { createContext, useContext, useEffect, useState } from "react";
import { fetchProfile, login as apiLogin } from "../api/client";
import type { AuthResponse } from "../api/client";
import type { ApiUser } from "../types/api";

interface AuthContextValue {
  user?: ApiUser;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<ApiUser | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const profile = await fetchProfile();
        setUser(profile);
      } catch {
        setUser(undefined);
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, []);

  const login = async (email: string, password: string) => {
    const res: AuthResponse = await apiLogin(email, password);
    localStorage.setItem("accessToken", res.accessToken);
    setUser(res.user);
  };

  const logout = () => {
    localStorage.removeItem("accessToken");
    setUser(undefined);
  };

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
