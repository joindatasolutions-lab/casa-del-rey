import { Link, useLocation } from "react-router-dom";

import { formatDate, formatTime } from "../services";

export default function SuccessPage() {
  const { state } = useLocation();
  const validDate = typeof state?.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(state.fecha)
    && Number.isFinite(Date.parse(`${state.fecha}T00:00:00Z`))
    && new Date(`${state.fecha}T00:00:00Z`).toISOString().slice(0, 10) === state.fecha;
  const hasConfirmation = ["ASISTIRA", "NO_ASISTIRA"].includes(state?.confirmacion)
    && typeof state?.nombre === "string" && state.nombre.trim()
    && typeof state?.grupo === "string" && state.grupo.trim() && validDate;

  if (!hasConfirmation) {
    return (
      <main className="public-main narrow">
        <section className="empty-state thanks-card">
          <img className="hero-logo" src="/logo.svg" alt="Casa del Rey" />
          <h1>Consulta tu encuentro</h1>
          <p>No hay una confirmación para mostrar. Vuelve al inicio para consultar tu grupo.</p>
          <Link className="primary-button" to="/">Volver al inicio</Link>
        </section>
      </main>
    );
  }
  const name = state?.nombre || "Gracias";
  const message =
    state?.confirmacion === "NO_ASISTIRA"
      ? `Gracias por avisarnos, ${name}. Esperamos verte pronto.`
      : `Gracias, ${name}! Tu asistencia quedo confirmada.`;

  return (
    <main className="public-main narrow">
      <section className="empty-state thanks-card">
        <img className="hero-logo" src="/logo.svg" alt="" />
        <span className="eyebrow">Casa del Rey</span>
        <h1>Gracias</h1>
        <p>{message}</p>

        <dl className="event-summary thanks-summary">
          <div>
            <dt>Nombre</dt>
            <dd>{state?.nombre || "-"}</dd>
          </div>
          <div>
            <dt>Grupo</dt>
            <dd>{state?.grupo || "-"}</dd>
          </div>
          <div>
            <dt>Fecha y hora</dt>
            <dd>
              {formatDate(state?.fecha)} - {formatTime(state?.hora)}
            </dd>
          </div>
          <div>
            <dt>Ubicacion</dt>
            <dd>{state?.ubicacion || "-"}</dd>
          </div>
        </dl>

        <div className="button-row">
          <Link className="primary-button" to="/">
            Volver al inicio
          </Link>
        </div>
      </section>
    </main>
  );
}
