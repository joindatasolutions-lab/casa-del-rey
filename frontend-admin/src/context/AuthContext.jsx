import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import api, { clearStoredAuth, getApiErrorMessage, getStoredAuth, setStoredAuth } from "../api/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getStoredAuth()?.token || null);
  const [user, setUser] = useState(() => getStoredAuth()?.user || null);
  const [loading, setLoading] = useState(Boolean(token));

  const logout = useCallback(() => {
    clearStoredAuth();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadCurrentUser() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get("/auth/me");
        if (isMounted) {
          setUser(data);
          setStoredAuth({ token, user: data });
        }
      } catch {
        if (isMounted) {
          logout();
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    loadCurrentUser();
    return () => {
      isMounted = false;
    };
  }, [logout, token]);

  const login = useCallback(async ({ email, password }) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setStoredAuth({ token: data.access_token, user: data.user });
      const meResponse = await api.get("/auth/me");
      const nextSession = { token: data.access_token, user: meResponse.data };
      setStoredAuth(nextSession);
      setToken(nextSession.token);
      setUser(nextSession.user);
      return nextSession;
    } catch (error) {
      clearStoredAuth();
      throw new Error(error?.response?.status === 401 ? "Email o password incorrectos." : getApiErrorMessage(error));
    }
  }, []);

  const value = useMemo(
    () => ({
      login,
      logout,
      user,
      token,
      loading,
      isAuthenticated: Boolean(token && user),
    }),
    [loading, login, logout, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return context;
}
