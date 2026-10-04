import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../AuthContext";

import {
  attendanceApi,
  eventsApi,
  formatDate,
  formatDay,
  formatTime,
  getFriendlyError,
  groupsApi,
  membersApi,
  normalizePhone,
} from "../services";

const emptyMemberForm = {
  nombre: "",
  apellido: "",
  fecha_nacimiento: "",
  genero: "",
  celular: "",
  direccion: "",
  contacto_emergencia: "",
  telefono_emergencia: "",
};

export default function GroupDetailPage() {
  const { slug } = useParams();
  const { user, refresh } = useAuth();
  const userRef = useRef(user);
  userRef.current = user;
  const pending = useRef(false);
  const savedMember = useRef(null);
  const formRef = useRef(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [refreshError, setRefreshError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const refreshPending = useRef(false);

  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [event, setEvent] = useState(null);
  const [step, setStep] = useState("detail");
  const [member, setMember] = useState(null);
  const canChooseGroup = !user.exists && !member;
  const [memberForm, setMemberForm] = useState(emptyMemberForm);
  const [status, setStatus] = useState({ loading: true, submitting: false, error: "", success: "" });
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    let alive = true;
    const user = userRef.current;
    const canChooseGroup = !user.exists;
    savedMember.current = null;
    setRefreshError("");
    setFieldErrors({});

    async function loadGroupAndEvent() {
      setStatus({ loading: true, submitting: false, error: "", success: "" });
      setStep("detail");
      setMember(user.member);
      setMemberForm({ ...emptyMemberForm, celular: user.celular });
      setGroup(null);
      setEvent(null);

      try {
        const nextGroup = await groupsApi.getBySlug(slug);
        if (!canChooseGroup && nextGroup.id_grupo !== user.id_grupo) {
          throw new Error("Sin permiso para este grupo");
        }
        let nextEvent = null;

        try {
          if (nextGroup.estado === "ACTIVO") nextEvent = await eventsApi.getNextForGroup(nextGroup.id_grupo);
        } catch (error) {
          if (error?.response?.status !== 404) throw error;
        }

        if (alive) {
          setGroup(nextGroup);
          setEvent(nextEvent);
          setStep(user.member && nextEvent ? "confirm" : "detail");
          setStatus({ loading: false, submitting: false, error: "", success: "" });
        }
      } catch (error) {
        if (alive) {
          setGroup(null);
          setEvent(null);
          setStatus({
            loading: false,
            submitting: false,
            error: getFriendlyError(error, "No pudimos cargar este grupo."),
            success: "",
          });
        }
      }
    }

    loadGroupAndEvent();
    return () => {
      alive = false;
    };
  }, [slug, user.celular]);

  function chooseAnotherGroup() {
    if (pending.current || refreshPending.current) return;
    setMember(null);
    setEvent(null);
    setMemberForm(emptyMemberForm);
    navigate("/");
  }

  function updateMemberForm(change) {
    const { name, value } = change.target;
    const nextValue = name === "celular" || name === "telefono_emergencia" ? normalizePhone(value) : value;
    setMemberForm((current) => ({ ...current, [name]: nextValue }));
    setFieldErrors((current) => ({ ...current, [name]: "" }));
  }

  function startAttendance() {
    if (!group?.id_grupo || (member && !event?.id_evento)) {
      setStatus((current) => ({
        ...current,
        error: "Por el momento no hay un proximo encuentro programado.",
      }));
      return;
    }
    setStep(member ? "confirm" : "register");
    setStatus((current) => ({ ...current, error: "", success: "" }));
  }

  async function handleRegister(submitEvent) {
    submitEvent.preventDefault();
    if (pending.current || savedMember.current) return;
    const errors = {};
    if (!memberForm.nombre.trim()) errors.nombre = "Ingresa tu nombre.";
    if (!memberForm.apellido.trim()) errors.apellido = "Ingresa tu apellido.";
    if (!["H", "M"].includes(memberForm.genero)) errors.genero = "Selecciona una opción.";
    if (memberForm.fecha_nacimiento && memberForm.fecha_nacimiento > today) errors.fecha_nacimiento = "La fecha no puede ser futura.";
    const emergencyPhone = normalizePhone(memberForm.telefono_emergencia);
    if (emergencyPhone && emergencyPhone.length !== 10) errors.telefono_emergencia = "Ingresa un celular de 10 dígitos.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      const input = Array.from(formRef.current?.elements || []).find((field) => errors[field.name]);
      const details = input?.closest("details");
      if (details) details.open = true;
      input?.focus();
      setStatus((current) => ({ ...current, error: "Revisa los campos indicados." }));
      return;
    }

    if (!group?.id_grupo) {
      setStatus((current) => ({ ...current, error: "Selecciona un grupo antes de registrarte." }));
      return;
    }

    const celular = user.celular;
    const telefonoEmergencia = normalizePhone(memberForm.telefono_emergencia);

    if (celular.length !== 10) {
      setStatus((current) => ({ ...current, error: "El celular debe tener 10 digitos." }));
      return;
    }
    pending.current = true;
    setStatus({ loading: false, submitting: true, error: "", success: "" });
    try {
      const result = await membersApi.create({
        id_grupo: group.id_grupo,
        nombre: memberForm.nombre.trim(),
        apellido: memberForm.apellido.trim(),
        fecha_nacimiento: memberForm.fecha_nacimiento || null,
        genero: memberForm.genero,
        celular,
        direccion: memberForm.direccion.trim() || null,
        contacto_emergencia: memberForm.contacto_emergencia.trim() || null,
        telefono_emergencia: telefonoEmergencia || null,
      });

      savedMember.current = result.member;
      setMember(result.member);
      setStep(event ? "confirm" : "registered");
      setStatus({ loading: false, submitting: false, error: "", success: "Registro guardado correctamente." });
    } catch (error) {
      setStatus((current) => ({ ...current, error: getFriendlyError(error) }));
    } finally {
      pending.current = false;
      setStatus((current) => ({ ...current, submitting: false }));
    }
    if (savedMember.current) await refreshSession();
  }

  async function refreshSession() {
    if (refreshPending.current) return;
    refreshPending.current = true;
    setRefreshing(true);
    setRefreshError("");
    try {
      await refresh();
    } catch {
      setRefreshError("Tu registro está guardado. No pudimos actualizar la sesión. Puedes reintentar sin volver a registrarte.");
    } finally {
      refreshPending.current = false;
      setRefreshing(false);
    }
  }

  async function handleConfirm(confirmacion) {
    if (pending.current || refreshPending.current) return;
    if (!group?.id_grupo || !event?.id_evento || !member?.id_miembro) {
      setStatus((current) => ({ ...current, error: "No se puede confirmar sin grupo, evento y miembro." }));
      return;
    }
    if (event.id_grupo !== group.id_grupo) {
      setStatus((current) => ({ ...current, error: "El evento no corresponde al grupo seleccionado." }));
      return;
    }

    pending.current = true;
    setStatus({ loading: false, submitting: true, error: "", success: "" });
    try {
      await attendanceApi.confirm({
        id_miembro: member.id_miembro,
        id_evento: event.id_evento,
        confirmacion,
      });
      navigate("/gracias", {
        state: {
          confirmacion,
          nombre: member.nombre,
          grupo: group.nombre_grupo,
          fecha: event.fecha_evento,
          hora: event.hora_evento || group.hora,
          ubicacion: event.ubicacion || group.ubicacion,
        },
      });
    } catch (error) {
      setStatus((current) => ({ ...current, error: getFriendlyError(error) }));
    } finally {
      pending.current = false;
      setStatus((current) => ({ ...current, submitting: false }));
    }
  }

  const eventLocation = event?.ubicacion || group?.ubicacion || "-";
  const eventTime = event?.hora_evento || group?.hora;

  if (status.loading) {
    return (
      <main className="public-main narrow">
        <section className="loader-card" role="status">
          <span className="loader" />
          <span>Cargando encuentro...</span>
        </section>
      </main>
    );
  }

  return (
    <main className="public-main narrow detail-main">
      <header className="compact-hero detail-hero">
        <div className="brand-row">
            <img className="hero-logo compact-logo" src="/logo.svg" alt="Casa del Rey" />
          <div>
            <span className="eyebrow">{group?.nombre_grupo || "Casa del Rey"}</span>
          </div>
        </div>
        <h1>{step === "detail" ? "Proximo encuentro" : step === "register" ? "Completa tu registro" : step === "registered" ? "Registro guardado" : "Confirmacion"}</h1>
        <p>{step === "register" ? "Después podrás confirmar tu asistencia" : "Consulta la información de tu encuentro."}</p>
      </header>

      <section className={`flow-card flow-card-${step}`}>
        {status.error ? <p className="form-error" role="alert">{status.error}</p> : null}
        {status.success ? <p className="form-success" role="status">{status.success}</p> : null}
        {refreshing ? <p role="status">Actualizando sesión...</p> : null}
        {refreshError ? <div><p className="form-error" role="alert">{refreshError}</p><button className="secondary-button" type="button" disabled={refreshing || status.submitting} onClick={refreshSession}>Reintentar actualización</button></div> : null}

        {group ? (
          <section className="meeting-summary">
            {event?.nombre_evento && event.nombre_evento !== group.nombre_grupo ? <h2>{event.nombre_evento}</h2> : null}
            <dl className="meeting-detail-list">
              <div>
                <span className="info-icon calendar-icon soft-icon" aria-hidden="true" />
                <span>
                  <dt>Fecha y hora</dt>
                  <dd>
                    {event
                      ? `${formatDate(event.fecha_evento)} - ${formatTime(eventTime)}`
                      : `${formatDay(group.dia_semana)} - ${formatTime(group.hora)}`}
                  </dd>
                </span>
              </div>
              <div>
                <span className="info-icon location-icon strong-location-icon" aria-hidden="true" />
                <span>
                  <dt>Ubicacion</dt>
                  <dd>{eventLocation}
                    {eventLocation !== "-" ? <a className="location-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(eventLocation)}`} target="_blank" rel="noreferrer">Ver ubicación</a> : null}
                  </dd>
                </span>
              </div>
            </dl>
          </section>
        ) : null}

        {!event && group ? <p className="muted-text">Aún no hay un próximo encuentro programado.{member ? " Tu registro está disponible para cuando se programe." : " Puedes guardar tu registro ahora."}</p> : null}
        {step === "detail" ? (
          <section className="confirm-panel">
            {event?.descripcion ? <p>{event.descripcion}</p> : null}
            <div className="button-row">
              {!member || event ? <button className="primary-button" disabled={!group || status.submitting} onClick={startAttendance} type="button">
                {member ? "Confirmar asistencia" : "Registrarme en este grupo"}
              </button> : null}
              <button className="secondary-button" onClick={chooseAnotherGroup} type="button">
                {canChooseGroup ? "Elegir otro grupo" : "Volver a mi grupo"}
              </button>
            </div>
          </section>
        ) : null}

        {step === "register" ? (
          <form ref={formRef} noValidate aria-busy={status.submitting} className="form-stack registration-form" onSubmit={handleRegister}>
            <p className="muted-text">Completa tus datos para guardar el registro.</p>
            <div className="form-grid compact-form-grid">
              <label>
                Nombre
                <input name="nombre" aria-invalid={Boolean(fieldErrors.nombre)} aria-describedby={fieldErrors.nombre ? "error-nombre" : undefined} onChange={updateMemberForm} required value={memberForm.nombre} />
              {fieldErrors.nombre ? <span className="field-error" id="error-nombre">{fieldErrors.nombre}</span> : null}
              </label>
              <label>
                Apellido
                <input name="apellido" aria-invalid={Boolean(fieldErrors.apellido)} aria-describedby={fieldErrors.apellido ? "error-apellido" : undefined} onChange={updateMemberForm} required value={memberForm.apellido} />
              {fieldErrors.apellido ? <span className="field-error" id="error-apellido">{fieldErrors.apellido}</span> : null}
              </label>
              <label>
                Fecha de nacimiento (opcional)
                <input
                  max={today}
                  name="fecha_nacimiento" aria-invalid={Boolean(fieldErrors.fecha_nacimiento)} aria-describedby={fieldErrors.fecha_nacimiento ? "error-fecha_nacimiento" : undefined}
                  onChange={updateMemberForm}
                  type="date"
                  value={memberForm.fecha_nacimiento}
                />
              {fieldErrors.fecha_nacimiento ? <span className="field-error" id="error-fecha_nacimiento">{fieldErrors.fecha_nacimiento}</span> : null}
              </label>
              <label>
                Genero
                <select name="genero" aria-invalid={Boolean(fieldErrors.genero)} aria-describedby={fieldErrors.genero ? "error-genero" : undefined} onChange={updateMemberForm} required value={memberForm.genero}>
                  <option value="">Selecciona una opción</option>
                  <option value="H">Hombre</option>
                  <option value="M">Mujer</option>
                </select>
              {fieldErrors.genero ? <span className="field-error" id="error-genero">{fieldErrors.genero}</span> : null}
              </label>
              <label>
                Celular
                <input inputMode="numeric" name="celular" onChange={updateMemberForm} required value={memberForm.celular} readOnly aria-describedby="phone-help" />
                <span className="field-help" id="phone-help">Para cambiarlo, usa «Cambiar celular» en la barra superior. Perderás los datos sin guardar.</span>
              </label>
            </div>

            <details className="optional-details">
              <summary>Opcionales</summary>
              <div className="form-grid compact-form-grid">
                <label>
                  Direccion
                  <input name="direccion" onChange={updateMemberForm} value={memberForm.direccion} />
                </label>
                <label>
                  Contacto de emergencia
                  <input name="contacto_emergencia" onChange={updateMemberForm} value={memberForm.contacto_emergencia} />
                </label>
                <label>
                  Telefono de emergencia
                  <input
                    inputMode="numeric"
                    name="telefono_emergencia" aria-invalid={Boolean(fieldErrors.telefono_emergencia)} aria-describedby={fieldErrors.telefono_emergencia ? "error-telefono_emergencia" : undefined}
                    onChange={updateMemberForm}
                    value={memberForm.telefono_emergencia}
                  />
                {fieldErrors.telefono_emergencia ? <span className="field-error" id="error-telefono_emergencia">{fieldErrors.telefono_emergencia}</span> : null}
              </label>
              </div>
            </details>
            <div className="button-row">
              <button className="primary-button" disabled={status.submitting || refreshing} type="submit">
                {status.submitting ? "Guardando..." : "Guardar y continuar"}
              </button>
              <button className="secondary-button" disabled={status.submitting || refreshing} onClick={chooseAnotherGroup} type="button">
                {canChooseGroup ? "Elegir otro grupo" : "Volver a mi grupo"}
              </button>
            </div>
          </form>
        ) : null}

        {step === "confirm" && member && event ? (
          <section className="confirm-panel">
            <h2>Hola, {member.nombre}</h2>
            <p>Vas a asistir a este encuentro?</p>
            {status.submitting ? <p role="status">Guardando confirmación...</p> : null}
            <div className="button-row">
              <button
                className="primary-button"
                disabled={status.submitting || refreshing}
                onClick={() => handleConfirm("ASISTIRA")}
                type="button"
              >
                Si, asistire
              </button>
              <button
                className="secondary-button"
                disabled={status.submitting || refreshing}
                onClick={() => handleConfirm("NO_ASISTIRA")}
                type="button"
              >
                No podre asistir
              </button>
            </div>
          </section>
        ) : null}
      </section>

      <Link className="text-link" to="/">
        Volver al inicio
      </Link>
    </main>
  );
}
