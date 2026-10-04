import axios from "axios";
import { getToken, setToken } from "./session";

const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? "/api"
    : "https://casa-del-rey-api-708265049038.us-central1.run.app/api");

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use((response) => response, (error) => {
  if (error?.response?.status === 401 && error.config?.url !== "/public/identificar") {
    setToken(null);
    window.dispatchEvent(new Event("public-session-expired"));
  }
  return Promise.reject(error);
});

export default api;
