import { useEffect, useMemo, useState } from "react";

import { GENDER_OPTIONS, RIO_DE_DIOS_OPTIONS, getFriendlyError, membersApi, normalizePhone } from "../../api/services";
import PageHeader from "../../components/common/PageHeader.jsx";
import StatusMessage from "../../components/common/StatusMessage.jsx";

const editableFields = [
  "nombre",
  "apellido",
  "fecha_nacimiento",
  "genero",
  "celular",
  "direccion",
  "contacto_emergencia",
  "telefono_emergencia",
];

export default function MembersPage() {
  const [members, setMembers] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState("");
  const [state, setState] = useState({ loading: true, error: "", success: "" });

  async function loadMembers() {
    setState({ loading: true, error: "", success: "" });
    try {
      setMembers(await membersApi.list());
      setState({ loading: false, error: "", success: "" });
    } catch (error) {
      setState({ loading: false, error: getFriendlyError(error), success: "" });
    }
  }

  useEffect(() => {
    loadMembers();
  }, []);

  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return members;
    return members.filter((member) =>
      `${member.nombre} ${member.apellido} ${member.celular} ${member.rio_de_dios} ${member.estado}`
        .toLowerCase()
        .includes(term),
    );
  }, [members, search]);

  function startEdit(member) {
    setEditingId(member.id_miembro);
    setForm(
      Object.fromEntries(
        editableFields.map((field) => [field, member[field] ?? (field === "genero" ? "H" : "")]),
      ),
    );
  }

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function saveMember(event) {
    event.preventDefault();
    const celular = normalizePhone(form.celular);
    const telefono = normalizePhone(form.telefono_emergencia);
    if (celular.length !== 10) {
      setState({ loading: false, error: "El celular debe tener 10 digitos.", success: "" });
      return;
    }
    if (telefono && telefono.length !== 10) {
      setState({ loading: false, error: "El telefono de emergencia debe tener 10 digitos.", success: "" });
      return;
    }
    const payload = {
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      fecha_nacimiento: form.fecha_nacimiento || null,
      genero: form.genero,
      celular,
      direccion: form.direccion.trim() || null,
      contacto_emergencia: form.contacto_emergencia.trim() || null,
      telefono_emergencia: telefono || null,
    };
    setBusyId(`save-${editingId}`);
    try {
      const updated = await membersApi.update(editingId, payload);
      setMembers((current) => current.map((member) => (member.id_miembro === updated.id_miembro ? updated : member)));
      setEditingId(null);
      setState({ loading: false, error: "", success: "Miembro actualizado." });
    } catch (error) {
      setState({ loading: false, error: getFriendlyError(error), success: "" });
    } finally {
      setBusyId("");
    }
  }

  async function updateStatus(member) {
    const estado = member.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO";
    if (estado === "INACTIVO" && !window.confirm("Seguro que deseas inactivar este miembro?")) return;
    setBusyId(`status-${member.id_miembro}`);
    try {
      const updated = await membersApi.updateStatus(member.id_miembro, estado);
      setMembers((current) => current.map((item) => (item.id_miembro === updated.id_miembro ? updated : item)));
      setState({ loading: false, error: "", success: "Estado actualizado." });
    } catch (error) {
      setState({ loading: false, error: getFriendlyError(error), success: "" });
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="admin-content">
      <PageHeader
        eyebrow="Directorio"
        title="Miembros"
        description="Listado y gestion de integrantes de la red."
      />
      <section className="toolbar">
        <label>
          Buscar
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, celular o estado" />
        </label>
      </section>
      <StatusMessage error={state.error} success={state.success} />
      {state.loading ? <p className="muted-text">Cargando miembros...</p> : null}

      <section className="member-card-list">
        {filteredMembers.map((member) => (
          <article className="member-card" key={member.id_miembro}>
            {editingId === member.id_miembro ? (
              <form className="form-stack" onSubmit={saveMember}>
                <div className="form-grid">
                  <label>
                    Nombre
                    <input name="nombre" onChange={updateForm} required value={form.nombre} />
                  </label>
                  <label>
                    Apellido
                    <input name="apellido" onChange={updateForm} required value={form.apellido} />
                  </label>
                  <label>
                    Fecha nacimiento
                    <input name="fecha_nacimiento" onChange={updateForm} type="date" value={form.fecha_nacimiento || ""} />
                  </label>
                  <label>
                    Genero
                    <select name="genero" onChange={updateForm} value={form.genero}>
                      {GENDER_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Celular
                    <input name="celular" onChange={updateForm} required value={form.celular} />
                  </label>
                  <label>
                    Direccion
                    <input name="direccion" onChange={updateForm} value={form.direccion || ""} />
                  </label>
                  <label>
                    Contacto emergencia
                    <input name="contacto_emergencia" onChange={updateForm} value={form.contacto_emergencia || ""} />
                  </label>
                  <label>
                    Telefono emergencia
                    <input name="telefono_emergencia" onChange={updateForm} value={form.telefono_emergencia || ""} />
                  </label>
                </div>
                <div className="button-row compact">
                  <button className="primary-button" disabled={busyId === `save-${editingId}`} type="submit">
                    Guardar
                  </button>
                  <button className="secondary-button" onClick={() => setEditingId(null)} type="button">
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div>
                  <h3>
                    {member.nombre} {member.apellido}
                  </h3>
                  <p>{member.celular}</p>
                </div>
                <div className="status-row">
                  <span>Genero: {member.genero || "-"}</span>
                  <span>Rio: {member.rio_de_dios || "-"}</span>
                  <span>Estado: {member.estado}</span>
                </div>
                <div className="button-row compact">
                  <button className="secondary-button" onClick={() => startEdit(member)} type="button">
                    Editar
                  </button>
                  <button
                    className="secondary-button"
                    disabled={busyId === `status-${member.id_miembro}`}
                    onClick={() => updateStatus(member)}
                    type="button"
                  >
                    {member.estado === "ACTIVO" ? "Inactivar" : "Activar"}
                  </button>
                </div>
              </>
            )}
          </article>
        ))}
      </section>

      {!state.loading && filteredMembers.length === 0 ? (
        <section className="empty-state">
          <h2>Sin miembros</h2>
          <p>No hay resultados para la busqueda actual.</p>
        </section>
      ) : null}
    </main>
  );
}
