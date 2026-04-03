import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import api from "../config/api";

interface User {
  id: string;
  email: string;
  username: string;
  role: "USER" | "ADMIN";
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

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
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
