from datetime import date

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.grupo import Grupo
from app.models.miembro import Miembro


def normalize_phone(value: str) -> str:
    stripped = value.strip()
    digits = "".join(character for character in stripped if character.isdigit())
    if len(digits) == 12 and digits.startswith("57"):
        digits = digits[2:]
    return digits


def require_valid_phone(value: str, field_name: str = "celular") -> str:
    phone = normalize_phone(value)
    if len(phone) != 10:
        raise HTTPException(status_code=400, detail=f"{field_name} debe tener 10 digitos")
    return phone


def normalize_gender(value: str) -> str:
    normalized = value.strip().upper()
    if normalized in {"H", "HOMBRE", "MASCULINO"}:
        return "H"
    if normalized in {"M", "MUJER", "FEMENINO"}:
        return "M"
    raise HTTPException(status_code=400, detail="genero debe ser H o M")


def require_non_empty(value: str, field_name: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail=f"{field_name} no puede estar vacio")
    return cleaned


def validate_birthdate(value: date | None) -> date | None:
    if value and value > date.today():
        raise HTTPException(status_code=400, detail="fecha_nacimiento no puede ser futura")
    return value


def get_active_group(db: Session, id_grupo: int) -> Grupo:
    grupo = db.get(Grupo, id_grupo)
    if grupo is None:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    if grupo.estado != "ACTIVO":
        raise HTTPException(status_code=400, detail="Grupo no esta activo")
    return grupo


def get_member(db: Session, id_miembro: int) -> Miembro:
    miembro = db.get(Miembro, id_miembro)
    if miembro is None:
        raise HTTPException(status_code=404, detail="Miembro no encontrado")
    return miembro


def find_member_by_group_and_phone(db: Session, id_grupo: int, celular: str) -> Miembro | None:
    query = select(Miembro).where(Miembro.id_grupo == id_grupo, Miembro.celular == celular)
    return db.scalars(query).first()


def ensure_phone_available(db: Session, id_grupo: int, celular: str, exclude_id_miembro: int | None = None) -> None:
    existing = find_member_by_group_and_phone(db, id_grupo, celular)
    if existing is not None and existing.id_miembro != exclude_id_miembro:
        raise HTTPException(status_code=409, detail="Ya existe un miembro con ese celular en el grupo")
