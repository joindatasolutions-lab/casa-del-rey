import api from "./api";

export const GENDER_OPTIONS = [
  { value: "H", label: "Hombre" },
  { value: "M", label: "Mujer" },
];

export function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length > 10 && digits.startsWith("57") ? digits.slice(-10) : digits;
}

export function formatDate(value) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "full" }).format(date);
}

export function formatTime(value) {
  if (!value) return "-";
  return String(value).slice(0, 5);
}

export function formatDay(value) {
  const days = {
    1: "Lunes",
    2: "Martes",
    3: "Miercoles",
    4: "Jueves",
    5: "Viernes",
    6: "Sabado",
    7: "Domingo",
  };
  return days[Number(value)] || "-";
}

export function getFriendlyError(error, fallback = "No pudimos completar la solicitud.") {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg).filter(Boolean).join(". ") || fallback;
  return fallback;
}

export const groupsApi = {
  list: () => api.get("/public/grupos").then((response) => response.data),
  getBySlug: (slug) => api.get(`/public/grupos/${slug}`).then((response) => response.data),
};

export const eventsApi = {
  getNextForGroup: (groupId) => api.get(`/public/grupos/${groupId}/eventos/proximo`).then((response) => response.data),
};

export const membersApi = {
  create: (payload) => api.post("/public/miembros", payload).then((response) => response.data),

};

export const attendanceApi = {
  confirm: (payload) => api.post("/public/asistencias/confirmar", payload).then((response) => response.data.attendance),
};
