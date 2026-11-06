import { unregisterPush } from "./push";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import api, { clearTokens, storeTokens, renewMobileSession, SessionChangedError, beginSessionLogout } from "./api";
import { AppState, DeviceEventEmitter } from "react-native";
import { useRouter } from "expo-router";
import { stopDriverTracking } from "./driverTracking";

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
  const router = useRouter();
  const [user, setUser] = useState<any>();
  const [loading, setLoading] = useState(true);
  const authEpoch = useRef(0);
  const currentUser = useRef(user); currentUser.current = user;

  const refreshUser = useCallback(async () => {
    const epoch = authEpoch.current;
    const res = await api.get("/auth/me");
    if (epoch !== authEpoch.current) throw new Error("Session changed");
    const profile = res.data.data.user;
    setUser(profile);
    return profile;
  }, []);

  useEffect(() => {
    let running = false, active = true;
    const bootstrap = async () => {
      if (running || currentUser.current) return;
      running = true;
      const epoch = authEpoch.current;
      try {
        // Opening the app restarts the rolling seven-day inactivity window.
        try { await renewMobileSession(); }
        catch (error: any) {
          if (error instanceof SessionChangedError || error.sessionExpired || [401, 403].includes(error.response?.status)) throw error;
          // A temporary refresh outage need not block a still-valid access token.
        }
        if (active && epoch === authEpoch.current) await refreshUser();
      } catch { if (active && epoch === authEpoch.current) setUser(undefined); }
      finally { running = false; if (active) setLoading(false); }
    };
    void bootstrap();
    const resumed = AppState.addEventListener("change", state => { if (state === "active" && !currentUser.current) void bootstrap(); });
    return () => { active = false; resumed.remove(); };
  }, []);

  useEffect(() => {
    if (!user) return;
    const renew = () => { void renewMobileSession().catch(() => {}); };
    const resumed = AppState.addEventListener("change", state => { if (state === "active") renew(); });
    // Keep long foreground visits alive, but do not renew while backgrounded.
    const timer = setInterval(() => { if (AppState.currentState === "active") renew(); }, 60 * 60 * 1000);
    const expired = DeviceEventEmitter.addListener("shopico:session-expired", () => {
      void logout().then(() => router.replace("/auth/login"));
    });
    return () => { resumed.remove(); expired.remove(); clearInterval(timer); };
  }, [user?._id]);

  const login = async (email: string, password: string) => {
    const epoch = ++authEpoch.current;
    const res = await api.post("/auth/login", { email, password });
    if (epoch !== authEpoch.current) throw new Error("Session changed");
    const { accessToken, refreshToken, user: profile } = res.data.data;
    await storeTokens(accessToken, refreshToken);
    setUser(profile);
  };

  const logout = async () => {
    authEpoch.current += 1;
    beginSessionLogout();
    try { await unregisterPush(); } catch { /* An expired/offline session still signs out locally. */ }
    try { await stopDriverTracking(); } catch { /* Tracking may not be available on this platform. */ }
    await clearTokens();
    setUser(undefined);
  };

  const setUserProfile = (profile: any) => { authEpoch.current += 1; setUser(profile); };

  return <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, setUserProfile }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
