import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import {
  RIO_DE_DIOS_OPTIONS,
  attendanceApi,
  eventsApi,
  formatCurrency,
  formatDate,
  formatTime,
  getLastCompletedEvent,
  getFriendlyError,
  groupsApi,
  membersApi,
  sortEventsByRecentDate,
} from "../../api/services";
import GroupSelector from "../../components/GroupSelector.jsx";
import PageHeader from "../../components/common/PageHeader.jsx";
import StatusMessage from "../../components/common/StatusMessage.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

export default function AttendancePage() {
  const [searchParams] = useSearchParams();
  const requestedGroup = searchParams.get("grupo");
  const requestedEvent = searchParams.get("evento");
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [useLastEvent, setUseLastEvent] = useState(false);
  const [attendance, setAttendance] = useState(null);
  const [search, setSearch] = useState("");
  const [offering, setOffering] = useState("");
  const [pending, setPending] = useState(new Set());
  const pendingRef = useRef(new Set());
  const selection = useRef(0);
  const [eventsLoading, setEventsLoading] = useState(false);
  function clearSelection() {
    selection.current++;
    setAttendance(null);
    setOffering("");
    setState({ loading: true, error: "", success: "" });
  }
  function changeGroup(id) {
    clearSelection();
    setEvents([]);
    setSelectedEventId("");
    setSelectedGroupId(id);
  }
  function changeEvent(id) {
    clearSelection();
    setSelectedEventId(id);
  }
  function isPending(key) { return pending.has(`${selectedEventId}:${key}`); }

  const [state, setState] = useState({ loading: true, error: "", success: "" });

  useEffect(() => {
    let alive = true;
    async function loadGroups() {
      try {
        const nextGroups = await groupsApi.list();
        if (!alive) return;
        setGroups(nextGroups);
        if (!nextGroups.length) setState({ loading: false, error: "", success: "" });
        const requested = nextGroups.find((group) => String(group.id_grupo) === requestedGroup);
        setSelectedGroupId(String(user?.rol === "LIDER_GRUPO" ? user.id_grupo : requested?.id_grupo || nextGroups[0]?.id_grupo || ""));
      } catch (error) {
        if (alive) setState({ loading: false, error: getFriendlyError(error), success: "" });
      }
    }
    loadGroups();
    return () => {
      alive = false;
    };
  }, [user, requestedGroup]);

  useEffect(() => {
    let alive = true;
    async function loadEvents() {
      setEvents([]);
      setSelectedEventId("");
      setAttendance(null);
      setSearch("");
      setOffering("");
      if (!selectedGroupId) return;
      setEventsLoading(true);
      setState({ loading: true, error: "", success: "" });
      try {
        const nextEvents = sortEventsByRecentDate(await eventsApi.listByGroup(selectedGroupId));
        if (!alive) return;
        const preferredEvent = useLastEvent ? getLastCompletedEvent(nextEvents) : nextEvents.find((item) => String(item.id_evento) === requestedEvent) || nextEvents[0];
        setEventsLoading(false);
        setEvents(nextEvents);
        setSelectedEventId(String(preferredEvent?.id_evento || ""));
        if (!preferredEvent) setState({ loading: false, error: "", success: "" });
      } catch (error) {
        if (alive) setState({ loading: false, error: getFriendlyError(error), success: "" });
      }
    }
    loadEvents().finally(() => { if (alive) setEventsLoading(false); });
    return () => {
      alive = false;
    };
  }, [selectedGroupId, useLastEvent, requestedEvent]);

  const lastCompletedEvent = useMemo(() => getLastCompletedEvent(events), [events]);

  function handleLastEventChange(checked) {
    clearSelection();
    setUseLastEvent(checked);
    const nextEvent = checked ? lastCompletedEvent : events[0];
    setSelectedEventId(String(nextEvent?.id_evento || ""));
  }

  useEffect(() => {
    let alive = true;
    const revision = selection.current;
    async function loadAttendance() {
      setAttendance(null);
      setOffering("");
      if (!selectedEventId) {
        setAttendance(null);
        return;
      }
      setState({ loading: true, error: "", success: "" });
      try {
        const detail = await eventsApi.getAttendance(selectedEventId);
        if (!alive || revision !== selection.current) return;
        setAttendance(detail);
        setOffering(String(detail.event.ofrenda_global ?? 0));
        setState({ loading: false, error: "", success: "" });
      } catch (error) {
        if (alive) setState({ loading: false, error: getFriendlyError(error), success: "" });
      }
    }
    loadAttendance();
    return () => {
      alive = false;
      selection.current++;
    };
  }, [selectedEventId, selectedGroupId, useLastEvent]);

  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase();
    const members = attendance?.members || [];
    if (!term) return members;
    return members.filter((member) =>
      `${member.nombre} ${member.apellido} ${member.celular}`.toLowerCase().includes(term),
    );
  }, [attendance, search]);

  const ready = !state.loading && !eventsLoading && attendance
    && String(attendance.event.id_evento) === selectedEventId
    && String(attendance.event.id_grupo) === selectedGroupId;

  async function saveOperation(key, request, apply, success = "") {
    if (!ready) return;
    const eventId = selectedEventId;
    const revision = selection.current;
    const operation = `${eventId}:${key}`;
    if (pendingRef.current.has(operation)) return;
    pendingRef.current.add(operation);
    setPending(new Set(pendingRef.current));
    setState((current) => ({ ...current, error: "", success: "" }));
    try {
      await request(eventId);
      if (revision !== selection.current) return;
      setAttendance((current) => current && String(current.event.id_evento) === eventId ? apply(current) : current);
      setState((current) => ({ ...current, success }));
    } catch (error) {
      if (revision === selection.current) setState((current) => ({ ...current, error: getFriendlyError(error) }));
    } finally {
      pendingRef.current.delete(operation);
      setPending(new Set(pendingRef.current));
    }
  }

  const updateMember = (id, changes) => (current) => ({ ...current,
    members: current.members.map((member) => member.id_miembro === id ? { ...member, ...changes } : member),
  });

  function markAttendance(member, asistio) {
    return saveOperation(`asistio-${member.id_miembro}`,
      (eventId) => attendanceApi.mark({ id_miembro: member.id_miembro, id_evento: Number(eventId), asistio }),
      updateMember(member.id_miembro, { asistio }));
  }

  function updateRio(member, rio_de_dios) {
    return saveOperation(`rio-${member.id_miembro}`,
      () => membersApi.updateRio(member.id_miembro, rio_de_dios),
      updateMember(member.id_miembro, { rio_de_dios }));
  }

  function saveOffering(eventSubmit) {
    eventSubmit.preventDefault();
    if (!ready) return;
    const amount = Number(offering);
    if (!offering.trim() || !Number.isFinite(amount) || amount < 0) {
      setState((current) => ({ ...current, error: "La ofrenda debe ser un numero mayor o igual a 0." }));
      return;
    }
    return saveOperation("offering", (eventId) => eventsApi.updateOffering(eventId, amount),
      (current) => ({ ...current, event: { ...current.event, ofrenda_global: amount } }), "Ofrenda actualizada.");
  }

  return (
    <main className="admin-content">
      <PageHeader
        eyebrow="Control"
        title="Asistencia"
        description="Marca asistencia, actualiza Rio de Dios y registra la ofrenda del evento."
      />

      <section className="toolbar">
        {user?.rol === "SUPER_ADMIN" ? (
          <GroupSelector groups={groups} value={selectedGroupId} onChange={changeGroup} />
        ) : null}
        <label className="event-mode-filter">
          <input
            checked={useLastEvent}
            disabled={eventsLoading || (!lastCompletedEvent && !useLastEvent)}
            onChange={(event) => handleLastEventChange(event.target.checked)}
            type="checkbox"
          />
          <span>Ultimo evento</span>
          <small>
            {lastCompletedEvent
              ? `${formatDate(lastCompletedEvent.fecha_evento)} - ${lastCompletedEvent.nombre_evento}`
              : "Sin eventos completados"}
          </small>
        </label>
        <label>
          Evento
          <select
            aria-label="Evento"
            disabled={eventsLoading || useLastEvent || !events.length}
            value={selectedEventId}
            onChange={(event) => changeEvent(event.target.value)}
          >
            {events.map((eventItem) => (
              <option key={eventItem.id_evento} value={eventItem.id_evento}>
                {formatDate(eventItem.fecha_evento)} - {eventItem.nombre_evento}
              </option>
            ))}
          </select>
        </label>
        <label>
          Buscar
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, apellido o celular" />
        </label>
      </section>

      <StatusMessage error={state.error} success={state.success} />
      {state.loading || eventsLoading ? <p className="muted-text">Cargando asistencia...</p> : null}

      {ready ? (
        <>
          <section className="panel-card event-toolbar">
            <div>
              <h2>{attendance.event.nombre_evento}</h2>
              <p>
                {formatDate(attendance.event.fecha_evento)} - {formatTime(attendance.event.hora_evento)} -{" "}
                {attendance.event.ubicacion || "-"}
              </p>
              <strong>{formatCurrency(attendance.event.ofrenda_global)}</strong>
            </div>
            <form className="inline-form" onSubmit={saveOffering}>
              <label>
                Ofrenda global
                <input min="0" onChange={(event) => setOffering(event.target.value)} type="number" value={offering} />
              </label>
              <button className="primary-button" disabled={isPending("offering")} type="submit">
                Guardar
              </button>
            </form>
          </section>

          <section className="member-card-list">
            {filteredMembers.map((member) => (
              <article className="member-card" key={member.id_miembro}>
                <div>
                  <h3>
                    {member.nombre} {member.apellido}
                  </h3>
                  <p>{member.celular}</p>
                </div>
                <div className="status-row">
                  <span>Confirmacion: {member.confirmacion || "Pendiente"}</span>
                  <span>Asistio: {member.asistio || "Pendiente"}</span>
                </div>
                <div className="segmented-actions">
                  <button
                    className={member.asistio === "SI" ? "active" : ""}
                    disabled={isPending(`asistio-${member.id_miembro}`)}
                    onClick={() => markAttendance(member, "SI")}
                    type="button"
                  >
                    Si asistio
                  </button>
                  <button
                    className={member.asistio === "NO" ? "active" : ""}
                    disabled={isPending(`asistio-${member.id_miembro}`)}
                    onClick={() => markAttendance(member, "NO")}
                    type="button"
                  >
                    No asistio
                  </button>
                </div>
                <label>
                  Rio de Dios
                  <select
                    disabled={isPending(`rio-${member.id_miembro}`)}
                    onChange={(event) => updateRio(member, event.target.value)}
                    value={member.rio_de_dios}
                  >
                    {RIO_DE_DIOS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </article>
            ))}
          </section>
        </>
      ) : !state.loading && !eventsLoading ? (
        <section className="empty-state">
          <h2>Sin evento seleccionado</h2>
          <p>Selecciona un grupo y un evento para iniciar el control de asistencia.</p>
        </section>
      ) : null}
    </main>
  );
}
