import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { formatDay, formatTime, getFriendlyError, groupsApi } from "../services";
import { useAuth } from "../AuthContext";

export default function HomePage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [state, setState] = useState({ loading: true, error: "" });

  useEffect(() => {
    let alive = true;
    async function loadGroups() {
      setState({ loading: true, error: "" });
      try {
        const nextGroups = await groupsApi.list();
        if (alive) {
          setGroups(nextGroups);
          setState({ loading: false, error: "" });
        }
      } catch (error) {
        if (alive) setState({ loading: false, error: getFriendlyError(error, "No pudimos cargar los grupos.") });
      }
    }
    loadGroups();
    return () => {
      alive = false;
    };
  }, []);

  const activeGroups = useMemo(() => groups.filter((group) =>
    !user.exists || group.id_grupo === user.id_grupo,
  ), [groups, user]);

  return (
    <main className="public-main home-main">
      <section className="group-selection">
        <header className="compact-hero">
          <img
            className="friendship-strip"
            src="/grupo-amistad-edades.png"
            alt="Jóvenes, adultos y personas mayores compartiendo un grupo de amistad en casa"
            width="1536"
            height="1024"
            fetchPriority="high"
          />
          <div className="brand-row">
            <img className="hero-logo compact-logo" src="/logo.svg" alt="" />
            <span className="eyebrow">Casa del Rey</span>
          </div>
          <h1>Tu proximo encuentro</h1>
          <p>{!user.exists ? "Eres nuevo. Elige tu grupo para completar el registro." : "Ya estas registrado. Aqui tienes la informacion de tu grupo."}</p>
        </header>

        {state.error ? <p className="form-error">{state.error}</p> : null}
        {state.loading ? <p className="muted-text">Cargando grupos...</p> : null}

        <section className="group-card-grid" aria-label="Grupos disponibles">
          {activeGroups.map((group) => (
            <article className="group-card" key={group.id_grupo}>
              <div className="group-card-main">
                <span className="day-pill">{formatDay(group.dia_semana)}</span>
                {group.estado !== "ACTIVO" ? <span className="day-pill">Inactivo</span> : null}
                <h2>{group.nombre_grupo}</h2>

                <p className="schedule-line">
                  <span className="info-icon calendar-icon" aria-hidden="true" />
                  <strong>
                    {formatDay(group.dia_semana)} - {formatTime(group.hora)}
                  </strong>
                </p>

                <p className="location-line">
                  <span className="info-icon location-icon" aria-hidden="true" />
                  <span>
                    {group.ubicacion || "Ubicacion por confirmar"}
                    {group.ubicacion ? (
                      <a
                        className="location-link"
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(group.ubicacion)}`}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Ver ubicacion {"->"}
                      </a>
                    ) : null}
                  </span>
                </p>
              </div>

              {group.responsable ? (
                <div className="responsible-row">
                  <span className="info-icon person-icon" aria-hidden="true" />
                  <span>
                    Responsable: <strong>{group.responsable}</strong>
                  </span>
                </div>
              ) : null}

              <Link className="primary-button" to={`/grupo/${group.slug}`}>
                Ver detalles del encuentro {"->"}
              </Link>
            </article>
          ))}
        </section>

        {!state.loading && activeGroups.length === 0 ? (
          <section className="empty-state">
            <h2>Sin grupos disponibles</h2>
            <p>No tienes un grupo disponible en este momento.</p>
          </section>
        ) : null}
      </section>
    </main>
  );
}
