/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import api from "../config/api";

// Detection mobile par media query (coherent avec useIsMobile)
function isMobileDevice(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

import { Preferences, DEFAULT_PREFERENCES } from "../types/preferences";

export type { Preferences, PreferenceKey } from "../types/preferences";

interface User {
  id: string;
  email: string | null;
  username: string;
  displayName: string | null;
  role: "USER" | "ADMIN";
  discordId: string | null;
  discordUsername: string | null;
  avatarUrl: string | null;
  preferences?: Preferences;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  preferences: Preferences;
  updatePreferences: (updates: Partial<Preferences>) => Promise<void>;
  logout: () => Promise<void>;
  // Retourne true si l'auth a abouti, false si l'utilisateur a ferme la popup sans completer.
  // En mode redirect (mobile ou popup bloquee), la page navigue et la promesse ne resout pas.
  initiateDiscordLogin: (returnTo?: string) => Promise<boolean>;
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

  const logout = async () => {
    await api.post("/api/auth/logout");
    setUser(null);
  };

  const preferences = user?.preferences ?? DEFAULT_PREFERENCES;

  // Mise a jour optimiste : l'UI reagit immediatement, rollback si le PATCH echoue
  const updatePreferences = useCallback(
    async (updates: Partial<Preferences>) => {
      const previous = user?.preferences ?? DEFAULT_PREFERENCES;
      setUser((u) => (u ? { ...u, preferences: { ...previous, ...updates } } : u));
      try {
        const res = await api.patch("/api/me/preferences", updates);
        setUser((u) => (u ? { ...u, preferences: res.data.preferences } : u));
      } catch (err) {
        setUser((u) => (u ? { ...u, preferences: previous } : u));
        throw err;
      }
    },
    [user]
  );

  const initiateDiscordLogin = useCallback(
    async (returnTo?: string): Promise<boolean> => {
      const buildParams = (popup: boolean) => {
        const p = new URLSearchParams();
        if (returnTo) p.set("returnTo", returnTo);
        if (popup) p.set("popup", "1");
        return p.toString();
      };

      // Mobile : redirect direct, pas de popup
      if (isMobileDevice()) {
        const res = await api.get(`/api/auth/discord?${buildParams(false)}`);
        window.location.href = res.data.url;
        return false;
      }

      // Tenter d'ouvrir une popup centree
      const res = await api.get(`/api/auth/discord?${buildParams(true)}`);
      const discordUrl: string = res.data.url;

      const width = 500;
      const height = 700;
      const left = Math.round(window.screen.width / 2 - width / 2);
      const top = Math.round(window.screen.height / 2 - height / 2);
      const popup = window.open(
        discordUrl,
        "discord-oauth",
        `width=${width},height=${height},left=${left},top=${top},toolbar=0,menubar=0,location=0`
      );

      if (!popup) {
        // Popup bloquee : fallback redirect sans flag popup
        const res2 = await api.get(`/api/auth/discord?${buildParams(false)}`);
        window.location.href = res2.data.url;
        return false;
      }

      return new Promise<boolean>((resolve, reject) => {
        let done = false;

        const cleanup = () => {
          window.removeEventListener("message", onMessage);
          clearInterval(pollInterval);
          clearTimeout(timeoutId);
        };

        const onMessage = (event: MessageEvent) => {
          // Le message vient de /oauth-popup, qui est sur la meme origine que le frontend
          if (event.origin !== window.location.origin) return;
          if (event.data?.type === "DISCORD_AUTH_SUCCESS") {
            done = true;
            cleanup();
            checkAuth().then(() => resolve(true));
          } else if (event.data?.type === "DISCORD_AUTH_ERROR") {
            done = true;
            cleanup();
            reject(new Error(event.data.error as string));
          }
        };

        // Detecte si l'utilisateur ferme la popup manuellement.
        // On appelle checkAuth() dans tous les cas : si l'auth a reussi mais que le
        // postMessage n'a pas encore ete recu, l'etat sera mis a jour quand meme.
        const pollInterval = setInterval(() => {
          if (!done && popup.closed) {
            done = true;
            cleanup();
            checkAuth().then(() => resolve(false));
          }
        }, 500);

        // Securite : nettoie apres 10 minutes sans reponse
        const timeoutId = setTimeout(
          () => {
            if (!done) {
              done = true;
              cleanup();
              try {
                popup.close();
              } catch {
                /* ignore */
              }
              resolve(false);
            }
          },
          10 * 60 * 1000
        );

        window.addEventListener("message", onMessage);
      });
    },
    [checkAuth]
  );

  const unlinkDiscord = async () => {
    await api.delete("/api/auth/discord/link");
    await checkAuth();
  };

  const refreshUser = checkAuth;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        preferences,
        updatePreferences,
        logout,
        initiateDiscordLogin,
        unlinkDiscord,
        refreshUser,
      }}
    >
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
