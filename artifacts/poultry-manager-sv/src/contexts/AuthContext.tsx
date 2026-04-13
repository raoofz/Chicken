import { createContext, useContext, type ReactNode } from "react";
import { useAuth as useReplitAuth, type AuthUser } from "@workspace/replit-auth-web";

export type { AuthUser };

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: () => void;
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, isLoading, login, logout } = useReplitAuth();

  return (
    <AuthContext.Provider value={{
      user,
      loading: isLoading,
      login,
      logout,
      isAdmin: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
