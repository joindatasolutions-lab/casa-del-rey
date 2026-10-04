import api from "./api";

export const RIO_DE_DIOS_OPTIONS = ["NUEVO", "CHANGE", "PEC", "ADL", "GRADUADO", "LANZADO", "LIDER"];
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
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(date);
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

export function formatCurrency(value) {
  return new Intl.NumberFormat("es-CO", {
    currency: "COP",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(Number(value || 0));
}

export function sortEventsByRecentDate(events) {
  const today = bogotaDate();
  return [...events].sort((first, second) => {
    const firstDate = first.fecha_evento || "";
    const secondDate = second.fecha_evento || "";
    const firstIsUpcoming = firstDate >= today;
    const secondIsUpcoming = secondDate >= today;

    if (firstIsUpcoming && !secondIsUpcoming) return -1;
    if (!firstIsUpcoming && secondIsUpcoming) return 1;
    if (firstIsUpcoming && secondIsUpcoming) return firstDate.localeCompare(secondDate);
    return secondDate.localeCompare(firstDate);
  });
}

// Contract times are local to America/Bogota (UTC-05:00, no DST).
export function eventStartTime(event) {
  if (!event?.fecha_evento || !event?.hora_evento) return null;
  const time = Date.parse(`${event.fecha_evento}T${event.hora_evento}-05:00`);
  return Number.isFinite(time) ? time : null;
}

export function bogotaDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function getLastCompletedEvent(events, now = new Date()) {
  const today = bogotaDate(now);
  return [...events].filter((event) => {
    if (event.estado !== "CERRADO" || !event.fecha_evento) return false;
    const start = eventStartTime(event);
    return start !== null ? start <= now.getTime() : event.fecha_evento < today;
  }).sort((a, b) => `${b.fecha_evento}T${b.hora_evento || ""}`.localeCompare(`${a.fecha_evento}T${a.hora_evento || ""}`))[0] || null;
}

export function eventTimingMessage(event, now = new Date()) {
  if (!event) return "Sin datos del encuentro.";
  if (event.estado === "CANCELADO") return "Encuentro cancelado.";
  const start = eventStartTime(event);
  if ((start !== null && start > now.getTime()) || event.fecha_evento > bogotaDate(now)) return "Encuentro programado para una fecha u hora futura.";
  if (event.estado === "CERRADO") return "Encuentro cerrado.";
  return "No hay datos suficientes para determinar si el encuentro ha terminado.";
}

export function getFriendlyError(error, fallback = "No pudimos completar la solicitud.") {
  if (error?.response?.status === 403) return "No tienes permisos para realizar esta accion";
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg).filter(Boolean).join(". ") || fallback;
  return fallback;
}

export const groupsApi = {
  list: () => api.get("/grupos").then((response) => response.data),
  getBySlug: (slug) => api.get(`/grupos/${slug}`).then((response) => response.data),
  create: (payload) => api.post("/grupos", payload).then((response) => response.data.group),
  update: (id, payload) => api.patch(`/grupos/${id}`, payload).then((response) => response.data.group),
  updateStatus: (id, estado) => api.patch(`/grupos/${id}/estado`, { estado }).then((response) => response.data.group),
};

export const eventsApi = {
  create: (payload) => api.post("/eventos", payload).then((response) => response.data),
  getAttendance: (id) => api.get(`/eventos/${id}/asistencia`).then((response) => response.data),
  getNextForGroup: (groupId) => api.get(`/grupos/${groupId}/eventos/proximo`).then((response) => response.data),
  listByGroup: (groupId) => api.get(`/grupos/${groupId}/eventos`).then((response) => response.data),
  update: (id, payload) => api.patch(`/eventos/${id}`, payload).then((response) => response.data.event),
  updateOffering: (id, ofrenda_global) =>
    api.patch(`/eventos/${id}/ofrenda`, { ofrenda_global }).then((response) => response.data),
  updateStatus: (id, estado) => api.patch(`/eventos/${id}/estado`, { estado }).then((response) => response.data.event),
};

export const membersApi = {
  create: (payload) => api.post("/miembros", payload).then((response) => response.data),
  list: () => api.get("/miembros").then((response) => response.data),
  search: (celular, grupoId) =>
    api.get("/miembros/buscar", { params: { celular, grupo_id: grupoId } }).then((response) => response.data),
  update: (id, payload) => api.patch(`/miembros/${id}`, payload).then((response) => response.data.member),
  updateRio: (id, rio_de_dios) =>
    api.patch(`/miembros/${id}/rio-de-dios`, { rio_de_dios }).then((response) => response.data.member),
  updateStatus: (id, estado) => api.patch(`/miembros/${id}/estado`, { estado }).then((response) => response.data.member),
};

export const attendanceApi = {
  confirm: (payload) => api.post("/asistencias/confirmar", payload).then((response) => response.data.attendance),
  mark: (payload) => api.patch("/asistencias/marcar", payload).then((response) => response.data.attendance),
};
