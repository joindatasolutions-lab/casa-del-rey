import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { eventsApi, groupsApi, membersApi, getFriendlyError, formatDate, formatTime, RIO_DE_DIOS_OPTIONS } from "../../api/services";
import { useAuth } from "../../context/AuthContext";
import Icon from "../../components/Icon";

export default function DisciplesPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState("");
  const [members, setMembers] = useState([]);
  const [event, setEvent] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [stage, setStage] = useState("NUEVO");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [success, setSuccess] = useState("");
  const dialog = useRef(null);

  useEffect(() => {
    let active = true;
    groupsApi.list().then((items) => {
      if (!active) return;
      const allowed = user.rol === "SUPER_ADMIN" ? items : items.filter((g) => g.id_grupo === user.id_grupo);
      setGroups(allowed);
      setGroupId(String(allowed[0]?.id_grupo || ""));
      if (!allowed.length) setLoading(false);
    }).catch((e) => { if (active) { setError(getFriendlyError(e)); setLoading(false); } });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!groupId) return;
    let active = true;
    setLoading(true); setError(""); setSuccess(""); setMembers([]); setEvent(null); setAttendance(null); setSearch("");
    async function load() {
      try {
        const [people, meeting] = await Promise.all([
          membersApi.list(),
          eventsApi.getNextForGroup(groupId).catch((e) => { if (e.response?.status === 404) return null; throw e; }),
        ]);
        const detail = meeting ? await eventsApi.getAttendance(meeting.id_evento) : null;
        if (active) {
          setMembers(people.filter((m) => String(m.id_grupo) === groupId && m.estado === "ACTIVO"));
          setEvent(meeting); setAttendance(detail);
        }
      } catch (e) { if (active) setError(getFriendlyError(e)); }
      finally { if (active) setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, [groupId]);

  const statuses = useMemo(() => new Map((attendance?.members || []).map((m) => [m.id_miembro, m.confirmacion])), [attendance]);
  const pending = event ? members.filter((m) => !statuses.get(m.id_miembro)).length : null;
  const confirmed = event ? members.filter((m) => statuses.get(m.id_miembro) === "ASISTIRA").length : null;
  const people = useMemo(() => [...members].sort((a, b) => Number(Boolean(statuses.get(a.id_miembro))) - Number(Boolean(statuses.get(b.id_miembro))))
    .filter((m) => `${m.nombre} ${m.apellido} ${m.celular}`.toLowerCase().includes(search.toLowerCase())), [members, statuses, search]);
  const metrics = [
    { icon: "people", label: "Discípulos", value: members.length, tone: "plum" },
    { icon: "clock", label: "Por confirmar", value: pending, tone: "peach" },
    { icon: "check", label: "Confirmados", value: confirmed, tone: "sage" },
    { icon: "new", label: "Nuevos", value: members.filter((m) => m.rio_de_dios === "NUEVO").length, tone: "stone" },
  ];

  function openFollowup(member = null) {
    setSelected(member); setStage(member?.rio_de_dios || "NUEVO"); setSaveError("");
    dialog.current.showModal();
  }
  async function saveFollowup(e) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true); setSaveError("");
    try {
      await membersApi.updateRio(selected.id_miembro, stage);
      setMembers((items) => items.map((m) => m.id_miembro === selected.id_miembro ? { ...m, rio_de_dios: stage } : m));
      setSuccess(`Etapa de ${selected.nombre} actualizada.`);
      dialog.current.close();
    } catch (e) { setSaveError(getFriendlyError(e)); }
    finally { setSaving(false); }
  }
  const attendanceLink = `/admin/asistencia?grupo=${groupId}${event ? `&evento=${event.id_evento}` : ""}`;

  return <main className="admin-content disciples-page">
    <header className="disciples-header">
      <div><h1>Seguimiento de discípulos</h1><p>Acompaña a tu grupo y prioriza a quienes necesitan atención.</p></div>
      <label className="disciples-group"><Icon name="people" /><span className="sr-only">Grupo</span>
        <select value={groupId} disabled={loading || user.rol !== "SUPER_ADMIN"} onChange={(e) => setGroupId(e.target.value)}>
          {!groups.length && <option value="">Sin grupo asignado</option>}
          {groups.map((g) => <option key={g.id_grupo} value={g.id_grupo}>{g.nombre_grupo}</option>)}
        </select>
      </label>
    </header>
    {error && <p className="form-error" role="alert">{error}</p>}
    {success && <p className="form-success" role="status">{success}</p>}
    <section className="disciples-metrics" aria-label="Resumen del grupo">
      {metrics.map((m) => <div className={`disciple-metric ${m.tone}`} key={m.label}><Icon name={m.icon} /><div><strong>{loading || error ? "—" : m.value ?? "—"}</strong><span>{m.label}</span></div></div>)}
    </section>
    <div className="disciples-grid">
      <section className="accompany-card">
        <div className="accompany-heading"><h2>Personas por acompañar</h2><span><Icon name="info" width="15" height="15" /> Próximo encuentro</span></div>
        {loading ? <p className="disciples-empty" role="status">Cargando tu grupo…</p> : !members.length ? <p className="disciples-empty">{error ? "No pudimos cargar los discípulos." : "Aún no hay discípulos activos en este grupo."}</p> : <>
          {members.length > 3 && <input className="disciples-search" aria-label="Buscar discípulo" placeholder="Buscar por nombre o celular…" value={search} onChange={(e) => setSearch(e.target.value)} />}
          <div className="disciples-list">
            {people.map((m) => {
              const status = statuses.get(m.id_miembro);
              const label = !event ? "Sin encuentro programado" : status === "ASISTIRA" ? "Asistencia confirmada" : status === "NO_ASISTIRA" ? "No asistirá" : "Pendiente de confirmar";
              return <article className="disciple-row" key={m.id_miembro}>
                <div className="disciple-avatar" aria-hidden="true">{m.nombre[0]}{m.apellido[0]}</div>
                <div className="disciple-person"><h3>{m.nombre} {m.apellido}</h3><span className={`disciple-badge ${status === "ASISTIRA" ? "confirmed" : !event ? "neutral" : ""}`}><Icon name={status === "ASISTIRA" ? "check" : "clock"} width="13" height="13" />{label}</span></div>
                <div className="disciple-contact"><span>Etapa actual</span><strong>{m.rio_de_dios || "Sin registro"}</strong></div>
                <button className="followup-link" type="button" onClick={() => openFollowup(m)}>Actualizar etapa <Icon name="arrow" width="16" height="16" /></button>
              </article>;
            })}
            {!people.length && <p className="disciples-empty">No hay coincidencias con tu búsqueda.</p>}
          </div>
        </>}
        <Link className="disciples-directory" to="/admin/miembros/directorio">Ver directorio y editar datos <Icon name="arrow" width="15" height="15" /></Link>
      </section>
      <aside className="next-meeting-card">
        <span className="meeting-icon"><Icon name="calendar" /></span>
        <h2>Próximo encuentro</h2><p>{loading ? "Cargando…" : event?.nombre_evento || "Sin encuentro programado"}</p>
        <div className="meeting-facts">
          <div><Icon name="calendar" /><span>{event ? `${formatDate(event.fecha_evento)} · ${formatTime(event.hora_evento)}` : "Fecha por definir"}</span></div>
          <div><Icon name="people" /><span>{event ? `${confirmed} de ${members.length} confirmados` : "Sin confirmaciones disponibles"}</span></div>
          <div><Icon name="clock" /><span>{event ? `${pending} pendientes` : "Programa el próximo encuentro"}</span></div>
        </div>
        <Link className="primary-button" to={event ? attendanceLink : "/admin/eventos"}>{event ? "Gestionar confirmaciones" : "Ver encuentros"}<Icon name="arrow" width="16" height="16" /></Link>
      </aside>
    </div>
    <section className="group-followup-bar">
      <span className="meeting-icon"><Icon name="chart" /></span><div><h2>Seguimiento del grupo</h2><p>Revisa la asistencia y registra avances de tu grupo.</p></div>
      <div className="followup-actions"><Link className="secondary-button" to={attendanceLink}><Icon name="calendar" />Consultar asistencia</Link><button className="primary-button" type="button" disabled={loading || !members.length} onClick={() => openFollowup()}><Icon name="edit" />Actualizar etapa de discípulo</button></div>
    </section>
    <dialog className="followup-dialog" ref={dialog} onCancel={(e) => { if (saving) e.preventDefault(); }}>
      <form onSubmit={saveFollowup} className="form-stack">
        <div className="accompany-heading"><h2>Actualizar etapa de discípulo</h2><button type="button" className="dialog-close" aria-label="Cerrar" disabled={saving} onClick={() => dialog.current.close()}><Icon name="close" /></button></div>
        <p>Actualiza únicamente su etapa en Río de Dios.</p>
        <label>Discípulo<select required disabled={saving} value={selected?.id_miembro || ""} onChange={(e) => { const m = members.find((m) => String(m.id_miembro) === e.target.value); setSelected(m); setStage(m?.rio_de_dios || "NUEVO"); }}><option value="">Selecciona una persona</option>{members.map((m) => <option value={m.id_miembro} key={m.id_miembro}>{m.nombre} {m.apellido}</option>)}</select></label>
        {selected && <p className="followup-phone">Celular: <a href={`tel:${selected.celular}`}>{selected.celular}</a></p>}
        <label>Etapa<select value={stage} disabled={saving} onChange={(e) => setStage(e.target.value)}>{RIO_DE_DIOS_OPTIONS.map((s) => <option key={s}>{s}</option>)}</select></label>
        {saveError && <p className="form-error" role="alert">{saveError}</p>}
        <button className="primary-button" disabled={!selected || saving} type="submit">{saving ? "Guardando…" : "Guardar etapa"}</button>
      </form>
    </dialog>
  </main>;
}
