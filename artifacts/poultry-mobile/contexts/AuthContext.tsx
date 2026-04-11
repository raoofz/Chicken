import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type UserRole = "admin" | "worker";

export interface AuthUser {
  id: number;
  username: string;
  name: string;
  role: UserRole;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "farm_auth_user";
const BASE =
  process.env.EXPO_PUBLIC_API_URL ||
  (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "");

async function apiFetch(path: string, opts: RequestInit = {}) {
  return fetch(`${BASE}${path}`, { ...opts, credentials: "include" });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setUser(JSON.parse(stored));
        }
        const res = await apiFetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } else {
          setUser(null);
          await AsyncStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // Network error - use cached user if available
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (username: string, password: string) => {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "خطأ في تسجيل الدخول");
    }
    const data = await res.json();
    setUser(data);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  const logout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {}
    setUser(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin: user?.role === "admin" }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
