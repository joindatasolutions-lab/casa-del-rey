import os
from datetime import date, timedelta
from uuid import uuid4

os.environ.setdefault("JWT_SECRET", "test-secret")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.database import engine
from app.main import app
from app.services.auth_service import hash_password

client = TestClient(app)
db_integration = pytest.mark.skipif(
    os.environ.get("RUN_DB_INTEGRATION_TESTS") != "1",
    reason="requires real PostgreSQL writes; set RUN_DB_INTEGRATION_TESTS=1 explicitly",
)


def create_user(email: str, role: str, id_grupo: int | None = None) -> None:
    password_hash = hash_password("Password123!")
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                insert into casa_del_rey.usuarios (
                    id_grupo, nombre, email, password_hash, rol, estado
                ) values (
                    :id_grupo, :nombre, :email, :password_hash, :rol, 'ACTIVO'
                )
                """
            ),
            {
                "id_grupo": id_grupo,
                "nombre": email.split("@")[0],
                "email": email,
                "password_hash": password_hash,
                "rol": role,
            },
        )


def login(email: str) -> str:
    response = client.post("/api/auth/login", json={"email": email, "password": "Password123!"})
    assert response.status_code == 200
    return response.json()["access_token"]


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def cleanup(email_prefix: str, group_slug: str, phones: list[str]) -> None:
    with engine.begin() as conn:
        group_id = conn.execute(
            text("select id_grupo from casa_del_rey.grupos where slug = :slug"), {"slug": group_slug}
        ).scalar_one_or_none()
        member_ids = [
            row[0]
            for row in conn.execute(
                text("select id_miembro from casa_del_rey.miembros where celular = any(:phones)"),
                {"phones": phones},
            ).all()
        ]
        event_ids = []
        if group_id is not None:
            event_ids = [
                row[0]
                for row in conn.execute(
                    text("select id_evento from casa_del_rey.eventos where id_grupo = :id_grupo"),
                    {"id_grupo": group_id},
                ).all()
            ]
        if event_ids:
            conn.execute(text("delete from casa_del_rey.asistencias where id_evento = any(:ids)"), {"ids": event_ids})
            conn.execute(text("delete from casa_del_rey.eventos where id_evento = any(:ids)"), {"ids": event_ids})
        if member_ids:
            conn.execute(text("delete from casa_del_rey.asistencias where id_miembro = any(:ids)"), {"ids": member_ids})
            conn.execute(text("delete from casa_del_rey.miembros where id_miembro = any(:ids)"), {"ids": member_ids})
        if group_id is not None:
            conn.execute(text("delete from casa_del_rey.grupos where id_grupo = :id_grupo"), {"id_grupo": group_id})
        conn.execute(text("delete from casa_del_rey.usuarios where email like :email"), {"email": f"{email_prefix}%"})


def test_routes_are_registered() -> None:
    paths = {route.path for route in app.routes}
    assert "/api/health" in paths
    assert "/api/auth/login" in paths
    assert "/api/grupos" in paths
    assert "/api/miembros/buscar" in paths
    assert "/api/eventos/generar" in paths
    assert "/api/asistencias/confirmar" in paths


@db_integration
def test_health_and_public_lookup() -> None:
    assert client.get("/api/health").status_code == 200
    assert client.get("/api/grupos/red-solteros-1").status_code == 200
    response = client.get("/api/miembros/buscar", params={"celular": "57 3128896624", "grupo_id": 1})
    assert response.status_code == 200
    assert response.json()["exists"] is True


@db_integration
def test_admin_crud_roles_events_and_attendance() -> None:
    suffix = uuid4().hex[:8]
    email_prefix = f"test-{suffix}"
    admin_email = f"{email_prefix}-admin@casadelrey.local"
    leader_email = f"{email_prefix}-leader@casadelrey.local"
    group_slug = f"grupo-test-{suffix}"
    phones = ["3991112201", "3991112202"]
    cleanup(email_prefix, group_slug, phones)

    try:
        create_user(admin_email, "SUPER_ADMIN")
        admin_token = login(admin_email)

        group_response = client.post(
            "/api/grupos",
            headers=auth_header(admin_token),
            json={
                "nombre_grupo": "Grupo Test",
                "slug": group_slug,
                "dia_semana": 3,
                "hora": "19:00:00",
                "ubicacion": "Temporal",
                "descripcion": "Temporal",
                "responsable": "Tester",
            },
        )
        assert group_response.status_code == 201
        group_id = group_response.json()["group"]["id_grupo"]

        create_user(leader_email, "LIDER_GRUPO", group_id)
        leader_token = login(leader_email)

        member_response = client.post(
            "/api/miembros",
            json={"id_grupo": group_id, "nombre": "Miembro", "apellido": "Test", "genero": "H", "celular": phones[0]},
        )
        assert member_response.status_code == 201
        member_id = member_response.json()["member"]["id_miembro"]

        assert client.patch(
            f"/api/miembros/{member_id}", headers=auth_header(leader_token), json={"nombre": "Miembro Editado"}
        ).status_code == 200
        assert client.patch(
            f"/api/miembros/{member_id}/estado", headers=auth_header(leader_token), json={"estado": "INACTIVO"}
        ).status_code == 200
        assert client.patch(
            f"/api/miembros/{member_id}/estado", headers=auth_header(leader_token), json={"estado": "ACTIVO"}
        ).status_code == 200

        event_date = (date.today() + timedelta(days=60)).isoformat()
        event_response = client.post(
            "/api/eventos",
            headers=auth_header(leader_token),
            json={
                "id_grupo": group_id,
                "nombre_evento": "Evento Test",
                "fecha_evento": event_date,
                "hora_evento": "19:00:00",
            },
        )
        assert event_response.status_code == 201
        event_id = event_response.json()["id_evento"]

        assert client.patch(
            f"/api/eventos/{event_id}", headers=auth_header(leader_token), json={"nombre_evento": "Evento Editado"}
        ).status_code == 200
        assert client.patch(
            f"/api/eventos/{event_id}/ofrenda", headers=auth_header(leader_token), json={"ofrenda_global": 1000}
        ).status_code == 200
        assert client.patch(
            f"/api/eventos/{event_id}/estado", headers=auth_header(leader_token), json={"estado": "CERRADO"}
        ).status_code == 200
        assert client.patch(
            f"/api/eventos/{event_id}/estado", headers=auth_header(leader_token), json={"estado": "ACTIVO"}
        ).status_code == 200

        assert client.post(
            "/api/asistencias/confirmar",
            json={"id_miembro": member_id, "id_evento": event_id, "confirmacion": "ASISTIRA"},
        ).status_code == 200
        assert client.patch(
            "/api/asistencias/marcar",
            headers=auth_header(leader_token),
            json={"id_miembro": member_id, "id_evento": event_id, "asistio": "SI"},
        ).status_code == 200
        metrics = client.get(f"/api/eventos/{event_id}/asistencia", headers=auth_header(leader_token))
        assert metrics.status_code == 200
        assert metrics.json()["metrics"]["asistieron"] == 1

        blocked = client.patch(
            "/api/eventos/3/ofrenda",
            headers=auth_header(leader_token),
            json={"ofrenda_global": 1000},
        )
        assert blocked.status_code == 403

        generated = client.post("/api/eventos/generar", headers=auth_header(admin_token), json={"semanas": 1})
        assert generated.status_code == 200
        generated_again = client.post("/api/eventos/generar", headers=auth_header(admin_token), json={"semanas": 1})
        assert generated_again.status_code == 200
    finally:
        cleanup(email_prefix, group_slug, phones)
