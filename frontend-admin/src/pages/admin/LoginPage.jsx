import { useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import "./LoginPage.css";

import { useAuth } from "../../context/AuthContext.jsx";

import loginPhoto from "../../img/login-admin.png";

function MailIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4.5 6.75h15v10.5h-15z" />
      <path d="m5.25 7.5 6.75 5.25 6.75-5.25" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="8" cy="12" r="3.25" />
      <path d="M11.25 12h8.25" />
      <path d="M16.5 12v3" />
      <path d="M19.5 12v2" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M2.75 12s3.25-5.25 9.25-5.25S21.25 12 21.25 12s-3.25 5.25-9.25 5.25S2.75 12 2.75 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const submitting = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const redirectTo = from ? `${from.pathname}${from.search || ""}${from.hash || ""}` : "/admin";

  if (isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError("");
    setLoading(true);
    try {
      await login(form);
      navigate(redirectTo, { replace: true });
    } catch (loginError) {
      setError(loginError.message === "Email o password incorrectos." ? "Correo o contraseña incorrectos." : loginError.message || "No pudimos iniciar sesión. Inténtalo nuevamente.");
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  return (
    <main className="admin-login">
      <section className="admin-login-card" aria-labelledby="login-title">
        <div className="admin-login-visual">
          {loginPhoto ? <img className="admin-login-photo" src={loginPhoto} alt="Administrador trabajando con un portátil en un ambiente cálido y profesional" /> : null}
          <div className="admin-login-caption">
            <p>Un espacio para conectar y acompañar</p>
            <span aria-hidden="true" />
          </div>
        </div>
        <div className="admin-login-content">
        <div className="brand-mark login-brand">
          <img src="/logo.svg" alt="" />
          <span>CASA DEL REY</span>
          <small>Red de Solteros</small>
        </div>

        <div className="login-copy">
          <span className="eyebrow">Panel administrativo</span>
          <h1 id="login-title">Inicia sesión</h1>
          <p>Accede con tu cuenta de líder o administrador</p>
        </div>

        <form className="form-stack" onSubmit={handleSubmit} aria-busy={loading}>
          <label htmlFor="login-email">
            Correo electrónico
            <span className="input-shell">
              <span className="input-icon">
                <MailIcon />
              </span>
              <input
                id="login-email"
                autoComplete="email"
                name="email"
                onChange={handleChange}
                placeholder="nombre@dominio.com"
                required
                type="email"
                value={form.email}
              />
            </span>
          </label>

          <label htmlFor="login-password">
            Contraseña
            <span className="input-shell">
              <span className="input-icon">
                <KeyIcon />
              </span>
              <input
                id="login-password"
                autoComplete="current-password"
                name="password"
                onChange={handleChange}
                required
                type={showPassword ? "text" : "password"}
                value={form.password}
              />
              <button
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-controls="login-password"
                aria-pressed={showPassword}
                className="icon-button eye-button"
                onClick={() => setShowPassword((current) => !current)}
                type="button"
              >
                <EyeIcon />
              </button>
            </span>
          </label>

          {error ? <p className="form-error" role="alert">{error}</p> : null}

          <button className="primary-button" disabled={loading} type="submit">
            {loading ? "Ingresando…" : <>Ingresar <span aria-hidden="true">→</span></>}
          </button>
          <p className="login-recovery">¿Necesitas recuperar el acceso?<br /><span>Contacta al administrador</span></p>
          <span className="visually-hidden" role="status">{loading ? "Ingresando…" : ""}</span>
        </form>
        </div>
      </section>
    </main>
  );
}
