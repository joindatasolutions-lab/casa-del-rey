from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import assert_group_access, get_optional_current_user, require_super_admin
from app.models.grupo import Grupo
from app.models.usuario import Usuario
from app.schemas.grupo import GrupoActionResponse, GrupoCreate, GrupoEstadoUpdate, GrupoResponse, GrupoUpdate

router = APIRouter(prefix="/grupos", tags=["grupos"])

GRUPO_ESTADO_VALUES = {"ACTIVO", "INACTIVO"}


def clean_required(value: str, field_name: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail=f"{field_name} no puede estar vacio")
    return cleaned


def validate_dia_semana(value: int | None) -> int | None:
    if value is not None and value not in range(1, 8):
        raise HTTPException(status_code=400, detail="dia_semana debe estar entre 1 y 7")
    return value


def ensure_slug_available(db: Session, slug: str, exclude_id_grupo: int | None = None) -> None:
    existing = db.scalars(select(Grupo).where(Grupo.slug == slug)).first()
    if existing is not None and existing.id_grupo != exclude_id_grupo:
        raise HTTPException(status_code=409, detail="slug ya existe")


@router.get("", response_model=list[GrupoResponse])
def list_grupos(
    db: Session = Depends(get_db), current_user: Usuario | None = Depends(get_optional_current_user)
) -> list[Grupo]:
    query = select(Grupo).order_by(Grupo.nombre_grupo)
    if current_user is None:
        query = query.where(Grupo.estado == "ACTIVO")
    elif current_user.rol not in {"SUPER_ADMIN", "LIDER_GRUPO"}:
        raise HTTPException(status_code=403, detail="Sin permiso")
    elif current_user.rol == "LIDER_GRUPO":
        query = query.where(Grupo.id_grupo == current_user.id_grupo)
    return list(db.scalars(query).all())


@router.post("", response_model=GrupoActionResponse, status_code=status.HTTP_201_CREATED)
def create_grupo(
    payload: GrupoCreate,
    db: Session = Depends(get_db),
    _current_user: Usuario = Depends(require_super_admin),
) -> dict[str, bool | Grupo]:
    nombre_grupo = clean_required(payload.nombre_grupo, "nombre_grupo")
    slug = clean_required(payload.slug, "slug")
    ensure_slug_available(db, slug)
    now = datetime.now(timezone.utc)
    grupo = Grupo(
        nombre_grupo=nombre_grupo,
        slug=slug,
        dia_semana=validate_dia_semana(payload.dia_semana),
        hora=payload.hora,
        ubicacion=payload.ubicacion,
        descripcion=payload.descripcion,
        responsable=payload.responsable,
        estado="ACTIVO",
        fecha_creacion=now,
        fecha_actualizacion=now,
    )
    try:
        db.add(grupo)
        db.commit()
        db.refresh(grupo)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error al crear grupo") from exc
    return {"success": True, "group": grupo}


@router.get("/{grupo_id_or_slug}", response_model=GrupoResponse)
def get_grupo(
    grupo_id_or_slug: str,
    db: Session = Depends(get_db),
    current_user: Usuario | None = Depends(get_optional_current_user),
) -> Grupo:
    if grupo_id_or_slug.isdigit():
        grupo = db.get(Grupo, int(grupo_id_or_slug))
    else:
        query = select(Grupo).where(Grupo.slug == grupo_id_or_slug)
        grupo = db.scalars(query).first()

    if grupo is None:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    if current_user is None:
        if grupo.estado != "ACTIVO":
            raise HTTPException(status_code=404, detail="Grupo no encontrado")
    elif current_user.rol not in {"SUPER_ADMIN", "LIDER_GRUPO"}:
        raise HTTPException(status_code=403, detail="Sin permiso")
    else:
        assert_group_access(current_user, grupo.id_grupo)
    return grupo


@router.patch("/{id_grupo}", response_model=GrupoActionResponse)
def update_grupo(
    id_grupo: int,
    payload: GrupoUpdate,
    db: Session = Depends(get_db),
    _current_user: Usuario = Depends(require_super_admin),
) -> dict[str, bool | Grupo]:
    grupo = db.get(Grupo, id_grupo)
    if grupo is None:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    changes = payload.model_dump(exclude_unset=True)
    if "nombre_grupo" in changes:
        grupo.nombre_grupo = clean_required(changes["nombre_grupo"], "nombre_grupo")
    if "slug" in changes:
        slug = clean_required(changes["slug"], "slug")
        ensure_slug_available(db, slug, exclude_id_grupo=grupo.id_grupo)
        grupo.slug = slug
    if "dia_semana" in changes:
        grupo.dia_semana = validate_dia_semana(changes["dia_semana"])
    for field_name in ("hora", "ubicacion", "descripcion", "responsable"):
        if field_name in changes:
            setattr(grupo, field_name, changes[field_name])
    grupo.fecha_actualizacion = datetime.now(timezone.utc)
    try:
        db.commit()
        db.refresh(grupo)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error al actualizar grupo") from exc
    return {"success": True, "group": grupo}


@router.patch("/{id_grupo}/estado", response_model=GrupoActionResponse)
def update_estado_grupo(
    id_grupo: int,
    payload: GrupoEstadoUpdate,
    db: Session = Depends(get_db),
    _current_user: Usuario = Depends(require_super_admin),
) -> dict[str, bool | Grupo]:
    grupo = db.get(Grupo, id_grupo)
    if grupo is None:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    estado = payload.estado.strip().upper()
    if estado not in GRUPO_ESTADO_VALUES:
        raise HTTPException(status_code=400, detail="estado debe ser ACTIVO o INACTIVO")
    grupo.estado = estado
    grupo.fecha_actualizacion = datetime.now(timezone.utc)
    try:
        db.commit()
        db.refresh(grupo)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error al actualizar estado del grupo") from exc
    return {"success": True, "group": grupo}
