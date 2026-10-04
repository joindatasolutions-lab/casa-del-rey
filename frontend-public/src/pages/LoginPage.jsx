import { useState } from "react";
import { useAuth } from "../AuthContext";
import { getFriendlyError, normalizePhone } from "../services";

export default function LoginPage() {
  const { login, error: sessionError } = useAuth();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const celular = normalizePhone(phone);
      if (!/^\d{10}$/.test(celular)) {
        setError("Ingresa un celular de 10 digitos.");
        return;
      }
      await login(celular);
    } catch (failure) {
      setError(getFriendlyError(failure, "No pudimos consultar tu celular. Intenta de nuevo."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="public-main narrow login-main">
      <section className="flow-card login-card">
        <img
          className="friendship-strip"
          src="/grupo-amistad-edades.png"
          alt="Jóvenes, adultos y personas mayores compartiendo un grupo de amistad en casa"
          width="1536"
          height="1024"
          fetchPriority="high"
        />
        <div className="login-content">
        <div className="login-brand">
          <img className="hero-logo compact-logo" src="/logo.svg" alt="" />
          <span className="eyebrow">Casa del Rey</span>
        </div>
        <h1>Ingresa tu celular</h1>
        <p className="login-description">Consultaremos si ya estás registrado para continuar con tu asistencia.</p>
        <form className="form-stack" onSubmit={submit} aria-busy={busy}>
          <label>Celular
            <span className="login-phone-control">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M10 18h4" /></svg>
              <input type="tel" inputMode="tel" autoComplete="tel" placeholder="3001234567" maxLength={20} required value={phone} aria-describedby="login-phone-help" onChange={(event) => setPhone(event.target.value)} />
            </span>
          </label>
          <span className="field-help" id="login-phone-help">Ingresa un celular de 10 dígitos.</span>
          {error || sessionError ? <p className="form-error" role="alert">{error || sessionError}</p> : null}
          <button className="primary-button" disabled={busy} type="submit">{busy ? "Consultando..." : "Continuar"}</button>
        </form>
        </div>
      </section>
    </main>
  );
}
