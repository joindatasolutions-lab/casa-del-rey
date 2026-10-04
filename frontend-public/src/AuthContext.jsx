import { createContext, useContext, useEffect, useState } from "react";
import api from "./api";
import { getToken, setToken } from "./session";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const expire = () => { setUser(null); setError(""); };
    window.addEventListener("public-session-expired", expire);
    async function restore() {
      try {
        if (getToken()) {
          const { data } = await api.get("/public/me");
          if (active) setUser(data);
        }
      } catch {
        if (active) setError("No pudimos recuperar tu consulta. Ingresa tu celular de nuevo.");
        setToken(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    restore();
    return () => {
      active = false;
      window.removeEventListener("public-session-expired", expire);
    };
  }, []);

  async function login(celular) {
    const { data } = await api.post("/public/identificar", { celular });
    setToken(data.access_token);
    setUser(data.user);
    setError("");
  }

  async function refresh() {
    const { data } = await api.get("/public/me");
    setUser(data);
  }

  function logout() {
    setToken(null);
    setUser(null);
    setError("");
  }

  return <AuthContext.Provider value={{ user, loading, error, login, logout, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
