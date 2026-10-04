import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { groupsApi } from "../api/services";

import { useAuth } from "../context/AuthContext.jsx";
import Icon from "./Icon.jsx";

const navItems = [
  { to: "/admin", label: "Inicio", icon: "home", end: true },
  { to: "/admin/miembros", label: "Discípulos", icon: "people" },
  { to: "/admin/asistencia", label: "Asistencia", icon: "calendar" },
  { to: "/admin/eventos", label: "Encuentros", icon: "book" },
  { to: "/admin/grupos", label: "Grupos", icon: "people" },
];

export default function AdminLayout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [groupName, setGroupName] = useState("");

  useEffect(() => {
    let active = true;
    setGroupName("");
    if (user?.id_grupo) {
      groupsApi.getBySlug(user.id_grupo).then((group) => {
        if (active) setGroupName(group.nombre_grupo);
      }).catch(() => {});
    }
    return () => { active = false; };
  }, [user?.id_grupo]);

  function handleLogout() {
    logout();
    navigate("/admin/login", { replace: true });
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <img src="/logo.svg" alt="" />
          <div>
            <span>CASA DEL REY</span>
            <small>Red de Solteros</small>
          </div>
        </div>

        <nav className="admin-nav" aria-label="Navegacion administrativa">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              <Icon name={item.icon} />{item.label}
            </NavLink>
          ))}
        </nav>

        <div className="admin-user">
          <span>{user?.nombre || "Administrador"}</span>
          <small>{user?.rol === "LIDER_GRUPO" ? "Administrador de grupo" : "Administrador general"}</small>
          {groupName ? <small>{groupName}</small> : null}
          <button className="text-button" type="button" onClick={handleLogout}>
            Cerrar sesion
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="mobile-admin-bar">
          <div>
            <img src="/logo.svg" alt="" />
            <span>CASA DEL REY</span>
            <small>Red de Solteros</small>
          </div>
          <button type="button" onClick={handleLogout}>
            Salir
          </button>
        </header>

        <nav className="mobile-admin-nav" aria-label="Navegacion administrativa movil">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              <Icon name={item.icon} />{item.label}
            </NavLink>
          ))}
        </nav>

        <Outlet />
      </div>
    </div>
  );
}
