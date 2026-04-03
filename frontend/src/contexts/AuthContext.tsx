import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import api from "../config/api";

interface User {
  id: string;
  email: string | null;
  username: string;
  role: "USER" | "ADMIN";
  discordId: string | null;
  discordUsername: string | null;
  avatarUrl: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (
    identifier: string,
    password: string,
    invitationToken?: string
  ) => Promise<{ eventId?: string }>;
  signup: (
    email: string,
    username: string,
    password: string,
    invitationToken: string
  ) => Promise<{ eventId: string }>;
  logout: () => Promise<void>;
  initiateDiscordLogin: (returnTo?: string) => Promise<void>;
  unlinkDiscord: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const res = await api.get("/api/auth/me");
      setUser(res.data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (identifier: string, password: string, invitationToken?: string) => {
    const res = await api.post("/api/auth/login", { identifier, password, invitationToken });
    setUser(res.data.user);
    return { eventId: res.data.eventId };
  };

  const signup = async (
    email: string,
    username: string,
    password: string,
    invitationToken: string
  ) => {
    const res = await api.post("/api/auth/signup", { email, username, password, invitationToken });
    setUser(res.data.user);
    return { eventId: res.data.eventId };
  };

  const logout = async () => {
    await api.post("/api/auth/logout");
    setUser(null);
  };

  const initiateDiscordLogin = async (returnTo?: string) => {
    const params = new URLSearchParams();
    if (returnTo) params.set("returnTo", returnTo);
    const res = await api.get(`/api/auth/discord?${params.toString()}`);
    window.location.href = res.data.url;
  };

  const unlinkDiscord = async () => {
    await api.delete("/api/auth/discord/link");
    await checkAuth();
  };

  const refreshUser = checkAuth;

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, initiateDiscordLogin, unlinkDiscord, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
