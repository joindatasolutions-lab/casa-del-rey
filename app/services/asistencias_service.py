from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.asistencia import Asistencia
from app.models.evento import Evento
from app.models.miembro import Miembro

CONFIRMATION_VALUES = {"ASISTIRA", "NO_ASISTIRA"}
ATTENDANCE_VALUES = {"SI", "NO"}


def get_member(db: Session, id_miembro: int) -> Miembro:
    miembro = db.get(Miembro, id_miembro)
    if miembro is None:
        raise HTTPException(status_code=404, detail="Miembro no encontrado")
    return miembro


def get_event(db: Session, id_evento: int) -> Evento:
    evento = db.get(Evento, id_evento)
    if evento is None:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    return evento


def require_same_group(miembro: Miembro, evento: Evento) -> None:
    if miembro.id_grupo != evento.id_grupo:
        raise HTTPException(status_code=409, detail="Miembro y evento pertenecen a grupos diferentes")


def normalize_choice(value: str, allowed: set[str], field_name: str) -> str:
    normalized = value.strip().upper()
    if normalized not in allowed:
        allowed_values = ", ".join(sorted(allowed))
        raise HTTPException(status_code=400, detail=f"{field_name} debe ser uno de: {allowed_values}")
    return normalized


def get_attendance(db: Session, id_miembro: int, id_evento: int) -> Asistencia | None:
    query = select(Asistencia).where(Asistencia.id_miembro == id_miembro, Asistencia.id_evento == id_evento)
    return db.scalars(query).first()


def get_or_create_attendance(db: Session, id_miembro: int, id_evento: int) -> Asistencia:
    asistencia = get_attendance(db, id_miembro, id_evento)
    if asistencia is not None:
        return asistencia
    asistencia = Asistencia(id_miembro=id_miembro, id_evento=id_evento)
    db.add(asistencia)
    return asistencia


def validate_member_event(db: Session, id_miembro: int, id_evento: int) -> tuple[Miembro, Evento]:
    miembro = get_member(db, id_miembro)
    evento = get_event(db, id_evento)
    require_same_group(miembro, evento)
    return miembro, evento


def now_utc() -> datetime:
    return datetime.now(timezone.utc)
