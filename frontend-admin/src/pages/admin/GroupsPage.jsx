import { useEffect, useState } from "react";

import { getFriendlyError, groupsApi } from "../../api/services";
import PageHeader from "../../components/common/PageHeader.jsx";
import StatusMessage from "../../components/common/StatusMessage.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

const emptyGroup = {
  nombre_grupo: "",
  slug: "",
  dia_semana: "",
  hora: "",
  ubicacion: "",
  descripcion: "",
  responsable: "",
};

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function GroupsPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyGroup);
  const [busyId, setBusyId] = useState("");
  const [state, setState] = useState({ loading: true, error: "", success: "" });
  const canCreate = user?.rol === "SUPER_ADMIN";
  const canManage = canCreate || user?.rol === "LIDER_GRUPO";

  async function loadGroups() {
    setState({ loading: true, error: "", success: "" });
    try {
      setGroups(await groupsApi.list());
      setState({ loading: false, error: "", success: "" });
    } catch (error) {
      setState({ loading: false, error: getFriendlyError(error), success: "" });
    }
  }

  useEffect(() => {
    loadGroups();
  }, []);

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "nombre_grupo" && !editing ? { slug: slugify(value) } : {}),
    }));
  }

  function startEdit(group) {
    setEditing(group.id_grupo);
    setForm({
      nombre_grupo: group.nombre_grupo,
      slug: group.slug,
      dia_semana: group.dia_semana || "",
      hora: group.hora ? String(group.hora).slice(0, 5) : "",
      ubicacion: group.ubicacion || "",
      descripcion: group.descripcion || "",
      responsable: group.responsable || "",
    });
  }

  async function saveGroup(event) {
    event.preventDefault();
    const payload = {
      nombre_grupo: form.nombre_grupo.trim(),
      slug: form.slug.trim(),
      dia_semana: form.dia_semana ? Number(form.dia_semana) : null,
      hora: form.hora || null,
      ubicacion: form.ubicacion.trim() || null,
      descripcion: form.descripcion.trim() || null,
      responsable: form.responsable.trim() || null,
    };
    setBusyId("group-save");
    try {
      if (editing) {
        await groupsApi.update(editing, payload);
        setState({ loading: false, error: "", success: "Grupo actualizado." });
      } else {
        await groupsApi.create(payload);
        setState({ loading: false, error: "", success: "Grupo creado." });
      }
      setEditing(null);
      setForm(emptyGroup);
      await loadGroups();
    } catch (error) {
      setState({ loading: false, error: getFriendlyError(error), success: "" });
    } finally {
      setBusyId("");
    }
  }

  async function updateStatus(group) {
    if (group.estado === "ACTIVO" && !window.confirm("Seguro que deseas inactivar este grupo?")) return;
    setBusyId(`group-${group.id_grupo}`);
    try {
      await groupsApi.updateStatus(group.id_grupo, group.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO");
      setState({ loading: false, error: "", success: "Estado del grupo actualizado." });
      await loadGroups();
    } catch (error) {
      setState({ loading: false, error: getFriendlyError(error), success: "" });
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="admin-content">
      <PageHeader
        eyebrow="Configuracion"
        title="Grupos"
        description="Gestion de grupos y responsables."
      />
      <StatusMessage error={state.error} success={state.success} />

      {canCreate || (canManage && editing) ? (
        <section className="panel-card">
          <h2>{editing ? "Editar grupo" : "Crear grupo"}</h2>
          <form className="form-stack" onSubmit={saveGroup}>
            <div className="form-grid">
              <label>
                Nombre
                <input name="nombre_grupo" onChange={updateForm} required value={form.nombre_grupo} />
              </label>
              <label>
                Slug
                <input name="slug" onChange={updateForm} required value={form.slug} />
              </label>
              <label>
                Dia semana
                <input max="7" min="1" name="dia_semana" onChange={updateForm} type="number" value={form.dia_semana} />
              </label>
              <label>
                Hora
                <input name="hora" onChange={updateForm} type="time" value={form.hora} />
              </label>
              <label>
                Ubicacion
                <input name="ubicacion" onChange={updateForm} value={form.ubicacion} />
              </label>
              <label>
                Responsable
                <input name="responsable" onChange={updateForm} value={form.responsable} />
              </label>
            </div>
            <label>
              Descripcion
              <textarea name="descripcion" onChange={updateForm} value={form.descripcion} />
            </label>
            <div className="button-row compact">
              <button className="primary-button" disabled={busyId === "group-save"} type="submit">
                {editing ? "Guardar" : "Crear"}
              </button>
              {editing ? (
                <button className="secondary-button" onClick={() => { setEditing(null); setForm(emptyGroup); }} type="button">
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>
        </section>
      ) : (
        <p className="muted-text">Puedes administrar tu grupo asignado desde el boton Editar.</p>
      )}

      {state.loading ? <p className="muted-text">Cargando grupos...</p> : null}
      <section className="member-card-list">
        {groups.map((group) => (
          <article className="member-card" key={group.id_grupo}>
            <div>
              <h3>{group.nombre_grupo}</h3>
              <p>{group.slug}</p>
            </div>
            <div className="status-row">
              <span>Estado: {group.estado}</span>
              <span>Responsable: {group.responsable || "-"}</span>
              <span>Ubicacion: {group.ubicacion || "-"}</span>
            </div>
            {canManage ? (
              <div className="button-row compact">
                <button className="secondary-button" onClick={() => startEdit(group)} type="button">
                  Editar
                </button>
                <button
                  className="secondary-button"
                  disabled={busyId === `group-${group.id_grupo}`}
                  onClick={() => updateStatus(group)}
                  type="button"
                >
                  {group.estado === "ACTIVO" ? "Inactivar" : "Activar"}
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  );
}
