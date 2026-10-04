import { useEffect, useRef, useState } from "react";

import {
  eventsApi,
  formatCurrency,
  formatDate,
  formatTime,
  getFriendlyError,
  groupsApi,
  sortEventsByRecentDate,
} from "../../api/services";
import GroupSelector from "../../components/GroupSelector.jsx";
import PageHeader from "../../components/common/PageHeader.jsx";
import StatusMessage from "../../components/common/StatusMessage.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

const emptyEvent = {
  nombre_evento: "",
  fecha_evento: "",
  hora_evento: "",
  ubicacion: "",
  descripcion: "",
  ofrenda_global: 0,
  estado: "ACTIVO",
};

export default function EventsPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [events, setEvents] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyEvent);
  const [busyId, setBusyId] = useState("");
  const saving = useRef(false);
  const revision = useRef(0);
  const listRequest = useRef(0);
  function changeGroup(id) {
    revision.current++;
    listRequest.current++;
    setEvents([]);
    setEditing(null);
    setForm(emptyEvent);
    setSelectedGroupId(id);
    setState({ loading: true, error: "", success: "" });
  }
  const [state, setState] = useState({ loading: true, error: "", success: "" });

  useEffect(() => {
    let alive = true;
    async function loadGroups() {
      try {
        const nextGroups = await groupsApi.list();
        if (!alive) return;
        setGroups(nextGroups);
        if (!nextGroups.length) setState({ loading: false, error: "", success: "" });
        setSelectedGroupId(String(user?.rol === "LIDER_GRUPO" ? user.id_grupo : nextGroups[0]?.id_grupo || ""));
      } catch (error) {
        setState({ loading: false, error: getFriendlyError(error), success: "" });
      }
    }
    loadGroups();
    return () => { alive = false; };
  }, [user]);

  useEffect(() => {
    setEvents([]);
    setEditing(null);
    setForm(emptyEvent);
    if (!selectedGroupId) return;
    loadEvents(selectedGroupId);
    return () => { listRequest.current++; revision.current++; };
  }, [selectedGroupId]);

  async function loadEvents(groupId, success = "", saveError = "") {
    const request = ++listRequest.current;
    const currentRevision = revision.current;
    setState({ loading: true, error: saveError, success });
    try {
      const result = await eventsApi.listByGroup(groupId);
      if (request !== listRequest.current || currentRevision !== revision.current) return;
      setEvents(sortEventsByRecentDate(result));
      setState({ loading: false, error: saveError, success });
    } catch (error) {
      if (request !== listRequest.current || currentRevision !== revision.current) return;
      setEvents([]);
      setState({ loading: false, error: [saveError, `No se pudo recargar el listado: ${getFriendlyError(error)}`].filter(Boolean).join(" "), success });
    }
  }

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function startEdit(eventItem) {
    setEditing(eventItem.id_evento);
    setForm({
      nombre_evento: eventItem.nombre_evento,
      fecha_evento: eventItem.fecha_evento,
      hora_evento: formatTime(eventItem.hora_evento),
      ubicacion: eventItem.ubicacion || "",
      descripcion: eventItem.descripcion || "",
      ofrenda_global: eventItem.ofrenda_global || 0,
      estado: eventItem.estado,
    });
  }

  async function saveEvent(eventSubmit) {
    eventSubmit.preventDefault();
    if (saving.current || !selectedGroupId || state.loading) return;
    saving.current = true;
    setBusyId("event-save");
    const groupId = selectedGroupId;
    const currentRevision = revision.current;
    let detailsSaved = false;
    let success = "";
    let saveError = "";
    const payload = {
      nombre_evento: form.nombre_evento.trim(),
      fecha_evento: form.fecha_evento,
      hora_evento: form.hora_evento || null,
      ubicacion: form.ubicacion.trim() || null,
      descripcion: form.descripcion.trim() || null,
    };
    try {
      if (editing) {
        await eventsApi.update(editing, payload);
        detailsSaved = true;
        await eventsApi.updateStatus(editing, form.estado);
        success = "Evento actualizado.";
      } else {
        await eventsApi.create({ ...payload, id_grupo: Number(groupId), ofrenda_global: Number(form.ofrenda_global || 0), estado: form.estado });
        success = "Evento creado.";
      }
    } catch (error) {
      if (detailsSaved) success = "Los datos del evento se guardaron.";
      saveError = detailsSaved ? `No se pudo actualizar el estado: ${getFriendlyError(error)}` : getFriendlyError(error);
    }
    try {
      if (currentRevision !== revision.current) return;
      if (!saveError) { setEditing(null); setForm(emptyEvent); }
      if (success) await loadEvents(groupId, success, saveError);
      else setState({ loading: false, error: saveError, success: "" });
    } finally {
      saving.current = false;
      setBusyId("");
    }
  }

  async function setEventStatus(eventItem, estado) {
    if (saving.current || state.loading) return;
    if (estado !== "ACTIVO" && !window.confirm(`Seguro que deseas marcar este evento como ${estado}?`)) return;
    saving.current = true;
    const currentRevision = revision.current;
    setBusyId(`status-${eventItem.id_evento}`);
    try {
      const updated = await eventsApi.updateStatus(eventItem.id_evento, estado);
      if (currentRevision !== revision.current) return;
      setEvents((current) => current.map((item) => item.id_evento === updated.id_evento ? updated : item));
      setState({ loading: false, error: "", success: "Estado del evento actualizado." });
    } catch (error) {
      if (currentRevision === revision.current) setState({ loading: false, error: getFriendlyError(error), success: "" });
    } finally {
      saving.current = false;
      setBusyId("");
    }
  }

  return (
    <main className="admin-content">
      <PageHeader
        eyebrow="Agenda"
        title="Eventos"
        description="Administracion de encuentros y programacion de la red."
      />
      <section className="toolbar">
        {user?.rol === "SUPER_ADMIN" ? (
          <GroupSelector groups={groups} value={selectedGroupId} onChange={changeGroup} />
        ) : null}
      </section>
      <StatusMessage error={state.error} success={state.success} />

      <section className="panel-card">
        <h2>{editing ? "Editar evento" : "Crear evento"}</h2>
        <form className="form-stack" onSubmit={saveEvent}>
          <div className="form-grid">
            <label>
              Nombre
              <input name="nombre_evento" onChange={updateForm} required value={form.nombre_evento} />
            </label>
            <label>
              Fecha
              <input name="fecha_evento" onChange={updateForm} required type="date" value={form.fecha_evento} />
            </label>
            <label>
              Hora
              <input name="hora_evento" onChange={updateForm} type="time" value={form.hora_evento} />
            </label>
            <label>
              Ubicacion
              <input name="ubicacion" onChange={updateForm} value={form.ubicacion} />
            </label>
            <label>
              Ofrenda
              <input disabled={Boolean(editing)} min="0" name="ofrenda_global" onChange={updateForm} type="number" value={form.ofrenda_global} />
            </label>
            <label>
              Estado
              <select name="estado" onChange={updateForm} value={form.estado}>
                <option value="ACTIVO">ACTIVO</option>
                <option value="CERRADO">CERRADO</option>
                <option value="CANCELADO">CANCELADO</option>
              </select>
            </label>
          </div>
          <label>
            Descripcion
            <textarea name="descripcion" onChange={updateForm} value={form.descripcion} />
          </label>
          <div className="button-row compact">
            <button className="primary-button" disabled={Boolean(busyId) || state.loading || !selectedGroupId} type="submit">
              {editing ? "Guardar" : "Crear"}
            </button>
            {editing ? (
              <button className="secondary-button" disabled={Boolean(busyId)} onClick={() => { setEditing(null); setForm(emptyEvent); }} type="button">
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      </section>

      {state.loading ? <p role="status">Cargando eventos...</p> : null}
      {!state.loading && state.error ? <button className="secondary-button" disabled={Boolean(busyId) || !selectedGroupId} onClick={() => loadEvents(selectedGroupId, state.success)} type="button">Recargar listado</button> : null}
      {!state.loading && !state.error && !events.length ? <p>No hay eventos disponibles para este grupo.</p> : null}
      <section className="member-card-list">
        {!state.loading && events.map((eventItem) => (
          <article className="member-card" key={eventItem.id_evento}>
            <div>
              <h3>{eventItem.nombre_evento}</h3>
              <p>
                {formatDate(eventItem.fecha_evento)} - {formatTime(eventItem.hora_evento)} - {eventItem.ubicacion || "-"}
              </p>
            </div>
            <div className="status-row">
              <span>Estado: {eventItem.estado}</span>
              <span>Ofrenda: {formatCurrency(eventItem.ofrenda_global)}</span>
            </div>
            <div className="button-row compact">
              <button className="secondary-button" disabled={Boolean(busyId) || state.loading} onClick={() => startEdit(eventItem)} type="button">
                Editar
              </button>
              <button disabled={Boolean(busyId) || state.loading} className="secondary-button" onClick={() => setEventStatus(eventItem, "CERRADO")} type="button">
                Cerrar
              </button>
              <button disabled={Boolean(busyId) || state.loading} className="secondary-button" onClick={() => setEventStatus(eventItem, "CANCELADO")} type="button">
                Cancelar
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
