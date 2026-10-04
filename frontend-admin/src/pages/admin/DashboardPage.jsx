import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

import {
  eventsApi,
  eventStartTime,
  bogotaDate,
  formatCurrency,
  formatDate,
  formatTime,
  getFriendlyError,
  groupsApi,
  sortEventsByRecentDate,
} from "../../api/services";
import GroupSelector from "../../components/GroupSelector.jsx";
import StatusMessage from "../../components/common/StatusMessage.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

import Icon from "../../components/Icon.jsx";
import DashboardBars from "./DashboardBars.jsx";
import "./DashboardPage.css";

export default function DashboardPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const [events, setEvents] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [attendance, setAttendance] = useState(null);
  const [state, setState] = useState({ loading: true, error: "" });

  useEffect(() => {
    let alive = true;
    async function loadGroups() {
      setState({ loading: true, error: "" });
      try {
        const nextGroups = await groupsApi.list();
        if (!alive) return;
        setGroups(nextGroups);
        if (!nextGroups.length || (user?.rol === "LIDER_GRUPO" && !user.id_grupo)) setState({ loading: false, error: "" });
        setSelectedGroupId(String(user?.rol === "LIDER_GRUPO" ? (user.id_grupo || "") : nextGroups[0]?.id_grupo || ""));
      } catch (error) {
        if (alive) setState({ loading: false, error: getFriendlyError(error) });
      }
    }
    loadGroups();
    return () => {
      alive = false;
    };
  }, [user]);

  useEffect(() => {
    let alive = true;
    async function loadDashboardBase() {
      setAttendance(null);

      setEvents([]);
      setSelectedEventId("");
      if (!selectedGroupId) return;
      setState({ loading: true, error: "" });
      try {
        const nextEvents = sortEventsByRecentDate(await eventsApi.listByGroup(selectedGroupId));
        if (!alive) return;
        setEvents(nextEvents);
        setSelectedEventId(String(nextEvents[0]?.id_evento || ""));
        if (!nextEvents.length) setState({ loading: false, error: "" });
      } catch (error) {
        if (alive) {
          setState({ loading: false, error: getFriendlyError(error, "No hay datos disponibles.") });
        }
        return;
      }
    }
    loadDashboardBase();
    return () => {
      alive = false;
    };
  }, [selectedGroupId]);

  useEffect(() => {
    let alive = true;
    async function loadSelectedEvent() {
      setAttendance(null);
      if (!selectedEventId) return;
      setState({ loading: true, error: "" });
      try {
        const nextAttendance = await eventsApi.getAttendance(selectedEventId);
        if (!alive) return;
        setAttendance(nextAttendance);
        setState({ loading: false, error: "" });
      } catch (error) {
        if (alive) {
          setAttendance(null);
          setState({ loading: false, error: getFriendlyError(error, "No hay datos disponibles.") });
        }
      }
    }
    loadSelectedEvent();
    return () => {
      alive = false;
    };
  }, [selectedEventId, selectedGroupId]);

  const selectedGroup = groups.find(group => String(group.id_grupo) === selectedGroupId);
  const selectedEvent = events.find(event => String(event.id_evento) === selectedEventId);
  const ready = !state.loading && !state.error && attendance
    && String(attendance.event?.id_evento) === selectedEventId
    && String(attendance.event?.id_grupo) === selectedGroupId;
  const metrics = ready ? attendance.metrics : null;
  const eventMembers = ready && Array.isArray(attendance.members) ? attendance.members : null;
  const count = value => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
  const display = value => count(value) ?? "—";
  const pendingConfirmations = eventMembers ? eventMembers.filter(member => member.confirmacion == null).length : null;
  const confirmationData = eventMembers ? [
    { label: "Confirmados", value: eventMembers.filter(member => member.confirmacion === "ASISTIRA").length, color: "#94b6a3" },
    { label: "Pendientes de confirmar", value: pendingConfirmations, color: "#e6cf9c" },
    { label: "No asistirán", value: eventMembers.filter(member => member.confirmacion === "NO_ASISTIRA").length, color: "#d8ada6" },
  ] : null;
  const unknownConfirmations = eventMembers?.filter(member => member.confirmacion != null && !["ASISTIRA", "NO_ASISTIRA"].includes(member.confirmacion)).length || 0;
  if (unknownConfirmations) confirmationData.push({ label: "Estado no reconocido", value: unknownConfirmations, color: "#c1c3bd" });
  const confirmationMismatch = confirmationData && metrics && (
    (count(metrics.confirmaron) !== null && metrics.confirmaron !== confirmationData[0].value)
    || (count(metrics.confirmaron_no) !== null && metrics.confirmaron_no !== confirmationData[2].value)
  );
  const genderData = eventMembers ? [
    { label: "Hombres", value: eventMembers.filter(member => member.genero?.trim() === "H").length, color: "#94b6a3" },
    { label: "Mujeres", value: eventMembers.filter(member => member.genero?.trim() === "M").length, color: "#d8ada6" },
    { label: "Sin género", value: eventMembers.filter(member => !["H", "M"].includes(member.genero?.trim())).length, color: "#c1c3bd" },
  ].filter(item => item.label !== "Sin género" || item.value > 0) : null;
  const start = eventStartTime(selectedEvent);
  const future = selectedEvent && ((start !== null && start > now) || selectedEvent.fecha_evento > bogotaDate(new Date(now)));
  const cancelled = selectedEvent?.estado === "CANCELADO";
  const closed = selectedEvent?.estado === "CERRADO";
  const eventStatus = cancelled ? "Encuentro cancelado" : future ? "Encuentro programado" : closed ? "Encuentro cerrado" : start !== null && start <= now ? "Encuentro iniciado" : "Horario por confirmar";
  const showAttendance = ready && !cancelled && !future && (closed || (start !== null && start <= now));
  const attendanceLink = `/admin/asistencia?${new URLSearchParams({ grupo: selectedGroupId, evento: selectedEventId })}`;
  const offering = ready ? attendance.event.ofrenda_global : null;
  const summaryCards = [
    { label: "Confirmados", value: confirmationData ? confirmationData[0].value : "—", icon: "check", tone: "sage" },
    { label: "Pendientes de confirmar", value: display(pendingConfirmations), icon: "clock", tone: "sand" },
    { label: "No asistirán", value: confirmationData ? confirmationData[2].value : "—", icon: "close", tone: "rose" },
    { label: "Ofrenda", value: offering != null && offering !== "" && Number.isFinite(Number(offering)) ? formatCurrency(offering) : "—", icon: "book", tone: "sage" },
  ];
  const indicatorMetrics = [
    { label: "Nuevos", value: metrics?.nuevos, icon: "new" },
    { label: "Líderes", value: metrics?.lideres, icon: "people" },
    { label: "Llegaron sin confirmar", value: metrics?.llegaron_sin_confirmar, icon: "arrow" },
  ];

  return <main className="dash-home" aria-busy={state.loading}>
    <header className="dash-heading">
      <div><h1>Inicio</h1><p>Resumen del encuentro seleccionado</p></div>
      <div className="dash-filters">
        {user?.rol === "SUPER_ADMIN" ? <GroupSelector groups={groups} value={selectedGroupId} onChange={id => {
          if (id === selectedGroupId) return;
          setAttendance(null); setEvents([]); setSelectedEventId(""); setState({ loading: true, error: "" }); setSelectedGroupId(id);
        }} /> : <div className="dash-fixed-group"><span>Grupo</span><strong>{selectedGroup?.nombre_grupo || "Sin grupo asignado"}</strong></div>}
        <label>Encuentro<select value={selectedEventId} disabled={!events.length || state.loading} onChange={event => {
          setAttendance(null); setState({ loading: true, error: "" }); setSelectedEventId(event.target.value);
        }}>
          {!events.length ? <option value="">Sin encuentros disponibles</option> : null}
          {events.map(event => <option key={event.id_evento} value={event.id_evento}>{formatDate(event.fecha_evento)} · {event.nombre_evento}</option>)}
        </select></label>
      </div>
    </header>
    <StatusMessage error={state.error} />
    {state.loading ? <p className="dash-notice" role="status">Cargando datos del encuentro…</p> : null}
    {!state.loading && !state.error && !selectedEvent ? <p className="dash-notice" role="status">{selectedGroupId ? "Este grupo no tiene encuentros disponibles." : "No hay un grupo disponible para consultar."}</p> : null}
    {selectedEvent ? <section className="dash-event" aria-label="Encuentro seleccionado">
      <span className="dash-icon sage"><Icon name="calendar" /></span>
      <div><h2>{selectedEvent.nombre_evento}</h2><p>{formatDate(selectedEvent.fecha_evento)} · {selectedEvent.hora_evento ? formatTime(selectedEvent.hora_evento) : "Hora por confirmar"} · {selectedGroup?.nombre_grupo || "Grupo no disponible"}</p></div>
      <span className="dash-status">{eventStatus}</span>
    </section> : null}
    <section className="dash-kpis" aria-label="Indicadores del encuentro">
      {summaryCards.map(item => <article className="dash-kpi" key={item.label}><span className={`dash-icon ${item.tone}`}><Icon name={item.icon} /></span><div><h2>{item.label}</h2><strong>{item.value}</strong></div></article>)}
    </section>
    <div className="dash-panels">
      <section className="dash-panel dash-confirmations">
        <header><span className="dash-icon sage"><Icon name="check" /></span><div><h2>Confirmaciones</h2><p>Respuesta de los miembros al encuentro.</p></div></header>
        {confirmationData ? <><p className="dash-summary"><strong>{confirmationData[0].value}</strong> confirmados de {eventMembers.length} miembros activos</p><DashboardBars data={confirmationData} stacked label="Confirmaciones" /></> : <p className="dash-note">{state.loading ? "Cargando confirmaciones…" : "Sin datos de confirmación disponibles."}</p>}
        {confirmationMismatch || unknownConfirmations ? <p className="dash-note" role="status">Hay diferencias en los datos recibidos. Se muestran los estados individuales de los miembros sin ajustar sus conteos.</p> : null}
        {ready ? <Link className="dash-action" to={attendanceLink}>Gestionar pendientes <Icon name="arrow" width="18" /></Link> : null}
      </section>
      <section className="dash-panel dash-gender">
        <header><span className="dash-icon rose"><Icon name="people" /></span><div><h2>Miembros del grupo</h2><p>Miembros activos incluidos en el encuentro.</p></div></header>
        <p className="dash-summary"><strong>{eventMembers?.length ?? "—"}</strong> miembros</p>
        {genderData ? <DashboardBars data={genderData} label="Distribución por género" /> : <p className="dash-note">Sin datos de miembros disponibles.</p>}
      </section>
      <section className="dash-panel dash-attendance">
        <header><span className="dash-icon sand"><Icon name="calendar" /></span><div><h2>Asistencia</h2><p>Registro del encuentro seleccionado.</p></div></header>
        {!selectedEvent ? <p className="dash-note">Selecciona un encuentro para consultar la asistencia.</p> : <div className="dash-attendance-state"><Icon name={future ? "clock" : "calendar"} /><strong>{eventStatus}</strong><p>{formatDate(selectedEvent.fecha_evento)} · {selectedEvent.hora_evento ? formatTime(selectedEvent.hora_evento) : "Hora por confirmar"}</p></div>}
        {showAttendance ? <><dl className="dash-attendance-counts"><div><dt>Asistieron</dt><dd>{display(metrics?.asistieron)}</dd></div><div><dt>No asistieron</dt><dd>{display(metrics?.no_asistieron)}</dd></div><div><dt>Sin registrar</dt><dd>{display(metrics?.pendientes)}</dd></div></dl><p className="dash-note">Conteos de miembros activos del encuentro.{!closed ? " El encuentro no figura como cerrado." : ""}</p></> : null}
        {!state.loading && selectedEvent && !ready && !state.error ? <p className="dash-note">Sin datos de asistencia disponibles.</p> : null}
      </section>
      <section className="dash-panel dash-indicators">
        <header><span className="dash-icon sage"><Icon name="chart" /></span><div><h2>Otros indicadores</h2><p>Personas con asistencia registrada.</p></div></header>
        <dl className="dash-indicator-list">{indicatorMetrics.map(item => <div key={item.label}><dt><Icon name={item.icon} />{item.label}</dt><dd>{display(item.value)}</dd></div>)}</dl>
      </section>
    </div>
  </main>;
}
