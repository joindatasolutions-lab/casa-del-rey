from datetime import date

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.evento import Evento
from app.models.grupo import Grupo


def get_group(db: Session, id_grupo: int) -> Grupo:
    grupo = db.get(Grupo, id_grupo)
    if grupo is None:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    return grupo


def get_active_group(db: Session, id_grupo: int) -> Grupo:
    grupo = get_group(db, id_grupo)
    if grupo.estado != "ACTIVO":
        raise HTTPException(status_code=400, detail="Grupo no esta activo")
    return grupo


def require_non_empty(value: str, field_name: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail=f"{field_name} no puede estar vacio")
    return cleaned


def normalize_event_status(value: str) -> str:
    normalized = value.strip().upper()
    if normalized not in {"ACTIVO", "CERRADO", "CANCELADO"}:
        raise HTTPException(status_code=400, detail="estado no es valido")
    return normalized


def get_event(db: Session, id_evento: int) -> Evento:
    evento = db.get(Evento, id_evento)
    if evento is None:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    return evento


def list_group_events(db: Session, id_grupo: int) -> list[Evento]:
    get_group(db, id_grupo)
    query = select(Evento).where(Evento.id_grupo == id_grupo).order_by(Evento.fecha_evento.desc(), Evento.hora_evento.desc())
    return list(db.scalars(query).all())


def ensure_event_date_available(
    db: Session, id_grupo: int, fecha_evento: date, exclude_id_evento: int | None = None
) -> None:
    query = select(Evento).where(Evento.id_grupo == id_grupo, Evento.fecha_evento == fecha_evento)
    existing = db.scalars(query).first()
    if existing is not None and existing.id_evento != exclude_id_evento:
        raise HTTPException(status_code=409, detail="Ya existe un evento para esa fecha en el grupo")


def get_next_group_event(db: Session, id_grupo: int) -> Evento:
    get_active_group(db, id_grupo)
    query = (
        select(Evento)
        .where(Evento.id_grupo == id_grupo, Evento.estado == "ACTIVO", Evento.fecha_evento >= date.today())
        .order_by(Evento.fecha_evento.asc(), Evento.hora_evento.asc())
    )
    evento = db.scalars(query).first()
    if evento is None:
        raise HTTPException(status_code=404, detail="No hay próximo evento disponible")
    return evento
