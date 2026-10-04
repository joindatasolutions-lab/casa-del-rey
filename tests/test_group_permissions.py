from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import BigInteger, create_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Grupo, Miembro, Evento, Asistencia, Usuario
from app.services.auth_service import hash_password


@compiles(BigInteger, "sqlite")
def sqlite_big_integer(element, compiler, **kwargs):
    return "INTEGER"


@pytest.fixture
def client():
    # All tables and writes stay in an isolated, in-memory database.
    engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
    with engine.begin() as connection:
        connection.connection.driver_connection.create_function("now", 0, lambda: datetime.now(timezone.utc).isoformat())
        connection.exec_driver_sql("ATTACH DATABASE ':memory:' AS casa_del_rey")
        Base.metadata.create_all(connection)
    with Session(engine) as db:
        now = datetime.now(timezone.utc)
        for group_id in (4, 5):
            db.add(Grupo(id_grupo=group_id, nombre_grupo=f"Grupo {group_id}", slug=f"grupo-{group_id}",
                         estado="ACTIVO", fecha_creacion=now, fecha_actualizacion=now))
            db.add(Miembro(id_miembro=group_id, id_grupo=group_id, nombre="Persona", apellido="Prueba",
                           celular=f"300000000{group_id}", genero="H", fecha_registro=now, fecha_actualizacion=now))
            db.add(Evento(id_evento=group_id, id_grupo=group_id, nombre_evento="Reunion",
                          fecha_evento=date.today() + timedelta(days=1), fecha_creacion=now, fecha_actualizacion=now))
            db.add(Asistencia(id_asistencia=group_id, id_miembro=group_id, id_evento=group_id,
                              fecha_actualizacion=now))
            db.add(Usuario(id_usuario=group_id, id_grupo=group_id, nombre="Admin de grupo",
                           email=f"admin{group_id}@example.com", password_hash=hash_password("TestPassword123!"),
                           rol="LIDER_GRUPO", estado="ACTIVO", fecha_creacion=now, fecha_actualizacion=now))
        db.commit()
        db.add(Usuario(id_usuario=9, nombre="Superadmin", email="super@example.com",
                       password_hash=hash_password("TestPassword123!"), rol="SUPER_ADMIN", estado="ACTIVO",
                       fecha_creacion=now, fecha_actualizacion=now))
        db.commit()
        app.dependency_overrides[get_db] = lambda: db
        try:
            with TestClient(app) as test_client:
                yield test_client
        finally:
            app.dependency_overrides.pop(get_db, None)
    engine.dispose()


def authenticate(client, group_id):
    result = client.post("/api/auth/login", json={"email": f"admin{group_id}@example.com", "password": "TestPassword123!"})
    assert result.status_code == 200
    client.headers["Authorization"] = f"Bearer {result.json()['access_token']}"


@pytest.mark.parametrize("group_id", [4, 5])
def test_login_limits_lists_and_allows_own_group_management(client, group_id):
    authenticate(client, group_id)
    assert client.get("/api/auth/me").json()["id_grupo"] == group_id
    for path in ("grupos", "miembros"):
        response = client.get(f"/api/{path}")
        assert response.status_code == 200
        assert {row["id_grupo"] for row in response.json()} == {group_id}
    response = client.patch(f"/api/grupos/{group_id}", json={"ubicacion": "Nueva ubicacion"})
    assert response.status_code == 200
    assert response.json()["group"]["ubicacion"] == "Nueva ubicacion"
    assert client.patch(f"/api/miembros/{group_id}", json={"nombre": "Editado"}).status_code == 200
    assert client.patch(f"/api/eventos/{group_id}/ofrenda", json={"ofrenda_global": 100}).status_code == 200
    assert client.patch("/api/asistencias/marcar", json={"id_miembro": group_id, "id_evento": group_id, "asistio": "SI"}).status_code == 200
    assert client.patch(f"/api/grupos/{group_id}/estado", json={"estado": "INACTIVO"}).status_code == 200


@pytest.mark.parametrize("group_id", [4, 5])
def test_other_group_is_forbidden_even_with_direct_requests(client, group_id):
    authenticate(client, group_id)
    other = 5 if group_id == 4 else 4
    requests = [
        ("GET", f"/grupos/{other}", None),
        ("GET", f"/grupos/grupo-{other}", None),
        ("PATCH", f"/grupos/{other}", {"ubicacion": "No permitido"}),
        ("PATCH", f"/grupos/{other}/estado", {"estado": "INACTIVO"}),
        ("GET", f"/miembros/{other}", None),
        ("GET", f"/miembros/buscar?grupo_id={other}&celular=300000000{other}", None),
        ("POST", "/miembros", {"id_grupo": other, "nombre": "Otro", "apellido": "Miembro", "genero": "H", "celular": "3001112222"}),
        ("PATCH", f"/miembros/{other}", {"nombre": "No permitido"}),
        ("PATCH", f"/miembros/{other}/estado", {"estado": "INACTIVO"}),
        ("PATCH", f"/miembros/{other}/rio-de-dios", {"rio_de_dios": "LIDER"}),
        ("GET", f"/grupos/{other}/eventos", None),
        ("GET", f"/grupos/{other}/eventos/proximo", None),
        ("GET", f"/eventos/{other}", None),
        ("GET", f"/eventos/{other}/asistencia", None),
        ("POST", "/eventos", {"id_grupo": other, "nombre_evento": "Otro", "fecha_evento": "2027-01-01"}),
        ("PATCH", f"/eventos/{other}", {"nombre_evento": "No permitido"}),
        ("PATCH", f"/eventos/{other}/estado", {"estado": "INACTIVO"}),
        ("PATCH", f"/eventos/{other}/ofrenda", {"ofrenda_global": 100}),
        ("POST", "/asistencias/confirmar", {"id_miembro": other, "id_evento": other, "confirmacion": "ASISTIRA"}),
        ("PATCH", "/asistencias/marcar", {"id_miembro": other, "id_evento": other, "asistio": "SI"}),
        ("POST", "/grupos", {"nombre_grupo": "Otro", "slug": "otro"}),
        ("POST", "/eventos/generar", {"semanas": 1}),
    ]
    for method, path, payload in requests:
        response = client.request(method, f"/api{path}", json=payload)
        assert response.status_code == 403, (method, path, response.text)


def test_authenticated_registration_flow_still_works(client):
    authenticate(client, 4)
    assert client.get("/api/grupos").status_code == 200
    assert client.get("/api/miembros/buscar?grupo_id=4&celular=3000000004").json()["exists"]
    assert client.post("/api/miembros", json={"id_grupo": 4, "nombre": "Persona", "apellido": "Prueba", "genero": "H", "celular": "3000000004"}).json()["exists"]
    assert client.get("/api/grupos/4/eventos/proximo").status_code == 200
    assert client.post("/api/asistencias/confirmar", json={"id_miembro": 4, "id_evento": 4, "confirmacion": "ASISTIRA"}).status_code == 200


def test_portal_requires_authentication(client):
    for path in ("/grupos", "/grupos/4", "/grupos/grupo-4", "/grupos/4/eventos/proximo", "/miembros/buscar?grupo_id=4&celular=3000000004"):
        assert client.get(f"/api{path}").status_code == 401
    assert client.post("/api/miembros", json={"id_grupo": 4, "nombre": "Persona", "apellido": "Prueba", "genero": "H", "celular": "3000000004"}).status_code == 401
    assert client.post("/api/asistencias/confirmar", json={"id_miembro": 4, "id_evento": 4, "confirmacion": "ASISTIRA"}).status_code == 401
    client.headers["Authorization"] = "Bearer invalid"
    assert client.get("/api/grupos").status_code == 401


def test_superadmin_sees_all_groups_including_inactive(client):
    login = client.post("/api/auth/login", json={"email": "super@example.com", "password": "TestPassword123!"})
    assert login.status_code == 200
    client.headers["Authorization"] = f"Bearer {login.json()['access_token']}"
    assert client.patch("/api/grupos/5/estado", json={"estado": "INACTIVO"}).status_code == 200
    assert {g["id_grupo"] for g in client.get("/api/grupos").json()} == {4, 5}
    for group in (4, 5):
        assert client.get(f"/api/grupos/{group}").status_code == 200


def identify_public(client, phone):
    response = client.post("/api/public/identificar", json={"celular": phone})
    assert response.status_code == 200, response.text
    client.headers["Authorization"] = f"Bearer {response.json()['access_token']}"
    return response.json()["user"]


@pytest.mark.parametrize("phone", ["3000000004", "+57 300 000 0004"])
def test_existing_public_member_needs_only_phone(client, phone):
    user = identify_public(client, phone)
    assert user["exists"] and user["id_grupo"] == 4
    assert set(user["member"]) == {"id_miembro", "nombre", "apellido"}
    assert [g["id_grupo"] for g in client.get("/api/public/grupos").json()] == [4]
    assert client.get("/api/public/grupos/grupo-4").status_code == 200
    assert client.get("/api/public/grupos/grupo-5").status_code == 403
    assert client.get("/api/public/grupos/5/eventos/proximo").status_code == 403
    assert client.post("/api/public/asistencias/confirmar", json={"id_miembro": 4, "id_evento": 4, "confirmacion": "ASISTIRA"}).status_code == 200
    assert client.post("/api/public/asistencias/confirmar", json={"id_miembro": 5, "id_evento": 5, "confirmacion": "ASISTIRA"}).status_code == 403
    for path in ("auth/me", "miembros", "grupos", "eventos/4/asistencia"):
        assert client.get(f"/api/{path}").status_code == 401
    assert client.patch("/api/miembros/4", json={"nombre": "No permitido"}).status_code == 401


def test_new_public_member_registration_and_scope(client):
    user = identify_public(client, "3001112222")
    assert not user["exists"] and user["member"] is None
    assert len(client.get("/api/public/grupos").json()) == 2
    payload = {"id_grupo": 4, "nombre": "Nuevo", "apellido": "Miembro", "genero": "H", "celular": "3001112222"}
    assert client.post("/api/public/miembros", json={**payload, "celular": "3000000005"}).status_code == 403
    result = client.post("/api/public/miembros", json=payload)
    assert result.status_code == 201, result.text
    member_id = result.json()["member"]["id_miembro"]
    assert not result.json()["exists"]
    assert client.post("/api/public/miembros", json=payload).json()["exists"]
    assert client.get("/api/public/me").json()["exists"]
    assert [g["id_grupo"] for g in client.get("/api/public/grupos").json()] == [4]
    assert client.post("/api/public/miembros", json={**payload, "id_grupo": 5}).status_code == 403
    response = client.post("/api/public/asistencias/confirmar", json={"id_miembro": member_id, "id_evento": 4, "confirmacion": "ASISTIRA"})
    assert response.status_code == 200, response.text


def test_public_invalid_phone_and_inactive_member(client):
    assert client.post("/api/public/identificar", json={"celular": "123"}).status_code == 400
    assert client.get("/api/public/grupos").status_code == 401
    authenticate(client, 4)
    assert client.patch("/api/miembros/4/estado", json={"estado": "INACTIVO"}).status_code == 200
    client.headers.pop("Authorization")
    assert client.post("/api/public/identificar", json={"celular": "3000000004"}).status_code == 403


def test_public_identification_does_not_require_user_account(client):
    db = app.dependency_overrides[get_db]()
    db.delete(db.get(Usuario, 4))
    member = db.get(Miembro, 4)
    member.celular = "+57 300 000 0004"
    db.commit()
    assert identify_public(client, "3000000004")["member"]["id_miembro"] == 4


def test_public_ambiguous_phone_does_not_choose_a_group(client):
    db = app.dependency_overrides[get_db]()
    db.get(Miembro, 5).celular = "3000000004"
    db.commit()
    assert client.post("/api/public/identificar", json={"celular": "3000000004"}).status_code == 409

