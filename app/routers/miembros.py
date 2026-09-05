from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import assert_group_access, require_admin_access
from app.models.miembro import Miembro
from app.models.usuario import Usuario
from app.schemas.miembro import (
    MiembroAdminResponse,
    MiembroCreate,
    MiembroCreateResponse,
    MiembroEstadoUpdate,
    MiembroEstadoUpdateResponse,
    MiembroPublicResponse,
    MiembroSearchResponse,
    MiembroUpdate,
    MiembroUpdateResponse,
    RioDeDiosUpdate,
    RioDeDiosUpdateResponse,
)
from app.services.miembros_service import (
    ensure_phone_available,
    find_member_by_group_and_phone,
    get_active_group,
    get_member,
    normalize_gender,
    require_non_empty,
    require_valid_phone,
    validate_birthdate,
)

router = APIRouter(prefix="/miembros", tags=["miembros"])

RIO_DE_DIOS_VALUES = {"NUEVO", "CHANGE", "PEC", "ADL", "GRADUADO", "LANZADO", "LIDER"}
MIEMBRO_ESTADO_VALUES = {"ACTIVO", "INACTIVO"}


@router.get("", response_model=list[MiembroAdminResponse])
def list_miembros(
    celular: str | None = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin_access),
) -> list[Miembro]:
    query = select(Miembro).order_by(Miembro.apellido, Miembro.nombre)
    if current_user.rol == "LIDER_GRUPO":
        query = query.where(Miembro.id_grupo == current_user.id_grupo)
    if celular:
        query = query.where(Miembro.celular == require_valid_phone(celular))
    return list(db.scalars(query).all())


@router.get("/buscar", response_model=MiembroSearchResponse)
def buscar_miembro(celular: str, grupo_id: int, db: Session = Depends(get_db)) -> dict[str, bool | Miembro | None]:
    get_active_group(db, grupo_id)
    normalized_phone = require_valid_phone(celular)
    miembro = find_member_by_group_and_phone(db, grupo_id, normalized_phone)
    return {"exists": miembro is not None, "member": miembro}


@router.post("", response_model=MiembroCreateResponse, status_code=status.HTTP_201_CREATED)
def create_miembro(payload: MiembroCreate, db: Session = Depends(get_db)) -> dict[str, bool | Miembro]:
    get_active_group(db, payload.id_grupo)
    nombre = require_non_empty(payload.nombre, "nombre")
    apellido = require_non_empty(payload.apellido, "apellido")
    celular = require_valid_phone(payload.celular)
    telefono_emergencia = (
        require_valid_phone(payload.telefono_emergencia, "telefono_emergencia")
        if payload.telefono_emergencia
        else None
    )
    existing = find_member_by_group_and_phone(db, payload.id_grupo, celular)
    if existing is not None:
        return {"success": True, "exists": True, "member": existing}

    miembro = Miembro(
        id_grupo=payload.id_grupo,
        nombre=nombre,
        apellido=apellido,
        fecha_nacimiento=validate_birthdate(payload.fecha_nacimiento),
        genero=normalize_gender(payload.genero),
        celular=celular,
        direccion=payload.direccion,
        contacto_emergencia=payload.contacto_emergencia,
        telefono_emergencia=telefono_emergencia,
        rio_de_dios="NUEVO",
        estado="ACTIVO",
    )
    try:
        db.add(miembro)
        db.commit()
        db.refresh(miembro)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error al crear miembro") from exc
    return {"success": True, "exists": False, "member": miembro}


@router.patch("/{id_miembro}", response_model=MiembroUpdateResponse)
def update_miembro(
    id_miembro: int,
    payload: MiembroUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin_access),
) -> dict[str, bool | Miembro]:
    miembro = get_member(db, id_miembro)
    assert_group_access(current_user, miembro.id_grupo)
    changes = payload.model_dump(exclude_unset=True)

    if "nombre" in changes:
        miembro.nombre = require_non_empty(changes["nombre"], "nombre")
    if "apellido" in changes:
        miembro.apellido = require_non_empty(changes["apellido"], "apellido")
    if "fecha_nacimiento" in changes:
        miembro.fecha_nacimiento = validate_birthdate(changes["fecha_nacimiento"])
    if "genero" in changes:
        miembro.genero = normalize_gender(changes["genero"])
    if "celular" in changes:
        celular = require_valid_phone(changes["celular"])
        ensure_phone_available(db, miembro.id_grupo, celular, exclude_id_miembro=miembro.id_miembro)
        miembro.celular = celular
    if "direccion" in changes:
        miembro.direccion = changes["direccion"]
    if "contacto_emergencia" in changes:
        miembro.contacto_emergencia = changes["contacto_emergencia"]
    if "telefono_emergencia" in changes:
        telefono = changes["telefono_emergencia"]
        miembro.telefono_emergencia = require_valid_phone(telefono, "telefono_emergencia") if telefono else None

    miembro.fecha_actualizacion = datetime.now(timezone.utc)

    try:
        db.commit()
        db.refresh(miembro)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error al actualizar miembro") from exc
    return {"success": True, "member": miembro}


@router.patch("/{id_miembro}/estado", response_model=MiembroEstadoUpdateResponse)
def update_estado_miembro(
    id_miembro: int,
    payload: MiembroEstadoUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin_access),
) -> dict[str, bool | Miembro]:
    miembro = get_member(db, id_miembro)
    assert_group_access(current_user, miembro.id_grupo)
    estado = payload.estado.strip().upper()
    if estado not in MIEMBRO_ESTADO_VALUES:
        raise HTTPException(status_code=400, detail="estado debe ser ACTIVO o INACTIVO")
    miembro.estado = estado
    miembro.fecha_actualizacion = datetime.now(timezone.utc)
    try:
        db.commit()
        db.refresh(miembro)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error al actualizar estado del miembro") from exc
    return {"success": True, "member": miembro}


@router.patch("/{id_miembro}/rio-de-dios", response_model=RioDeDiosUpdateResponse)
def update_rio_de_dios(
    id_miembro: int,
    payload: RioDeDiosUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin_access),
) -> dict[str, bool | Miembro]:
    miembro = get_member(db, id_miembro)
    assert_group_access(current_user, miembro.id_grupo)
    rio_de_dios = payload.rio_de_dios.strip().upper()
    if rio_de_dios not in RIO_DE_DIOS_VALUES:
        raise HTTPException(status_code=400, detail="rio_de_dios no es valido")
    miembro.rio_de_dios = rio_de_dios
    try:
        db.commit()
        db.refresh(miembro)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error al actualizar Rio de Dios") from exc
    return {"success": True, "member": miembro}


@router.get("/{id_miembro}", response_model=MiembroAdminResponse)
def get_miembro(
    id_miembro: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin_access),
) -> Miembro:
    miembro = get_member(db, id_miembro)
    assert_group_access(current_user, miembro.id_grupo)
    return miembro
