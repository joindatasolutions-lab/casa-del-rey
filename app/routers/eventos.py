from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import assert_group_access, require_admin_access, require_super_admin
from app.models.asistencia import Asistencia
from app.models.evento import Evento
from app.models.miembro import Miembro
from app.models.usuario import Usuario
from app.schemas.evento import (
    AttendanceEventResponse,
    AttendanceMemberResponse,
    AttendanceMetricsResponse,
    EventAttendanceDetailResponse,
    EventoActionResponse,
    EventoCreate,
    EventoEstadoUpdate,
    EventoResponse,
    EventoUpdate,
    GenerateEventsRequest,
    GenerateEventsResponse,
    OfrendaUpdate,
    OfrendaUpdateResponse,
)
from app.services.eventos_automaticos_service import generate_future_events
from app.services.eventos_service import (
    ensure_event_date_available,
    get_active_group,
    get_event,
    get_group,
    get_next_group_event,
    list_group_events,
    normalize_event_status,
    require_non_empty,
)

router = APIRouter(tags=["eventos"])


@router.post("/eventos", response_model=EventoResponse, status_code=201)
def create_evento(
    payload: EventoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin_access),
) -> Evento:
    if payload.ofrenda_global < 0:
        raise HTTPException(status_code=400, detail="ofrenda_global debe ser mayor o igual a 0")
    get_active_group(db, payload.id_grupo)
    assert_group_access(current_user, payload.id_grupo)
    ensure_event_date_available(db, payload.id_grupo, payload.fecha_evento)
    evento = Evento(
        id_grupo=payload.id_grupo,
        nombre_evento=require_non_empty(payload.nombre_evento, "nombre_evento"),
        fecha_evento=payload.fecha_evento,
        hora_evento=payload.hora_evento,
        ubicacion=payload.ubicacion,
        descripcion=payload.descripcion,
        ofrenda_global=payload.ofrenda_global,
        estado=normalize_event_status(payload.estado),
    )
    try:
        db.add(evento)
        db.commit()
        db.refresh(evento)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error al crear evento") from exc
    return evento


@router.post("/eventos/generar", response_model=GenerateEventsResponse)
def generate_eventos(
    payload: GenerateEventsRequest | None = None,
    db: Session = Depends(get_db),
    _current_user: Usuario = Depends(require_super_admin),
) -> dict[str, int | bool]:
    semanas = payload.semanas if payload else 12
    try:
        result = generate_future_events(db, semanas)
        db.commit()
        return result
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error al generar eventos") from exc


@router.get("/grupos/{id_grupo}/eventos", response_model=list[EventoResponse])
def list_eventos_grupo(
    id_grupo: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin_access),
) -> list[Evento]:
    assert_group_access(current_user, id_grupo)
    return list_group_events(db, id_grupo)


@router.get("/grupos/{id_grupo}/eventos/proximo", response_model=EventoResponse)
def get_proximo_evento(id_grupo: int, db: Session = Depends(get_db)) -> Evento:
    return get_next_group_event(db, id_grupo)


@router.get("/eventos/{id_evento}", response_model=EventoResponse)
def get_evento(
    id_evento: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin_access),
) -> Evento:
    evento = get_event(db, id_evento)
    assert_group_access(current_user, evento.id_grupo)
    return evento


@router.patch("/eventos/{id_evento}", response_model=EventoActionResponse)
def update_evento(
    id_evento: int,
    payload: EventoUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin_access),
) -> dict[str, bool | Evento]:
    evento = get_event(db, id_evento)
    assert_group_access(current_user, evento.id_grupo)
    changes = payload.model_dump(exclude_unset=True)
    if "nombre_evento" in changes:
        evento.nombre_evento = require_non_empty(changes["nombre_evento"], "nombre_evento")
    if "fecha_evento" in changes:
        ensure_event_date_available(db, evento.id_grupo, changes["fecha_evento"], exclude_id_evento=evento.id_evento)
        evento.fecha_evento = changes["fecha_evento"]
    for field_name in ("hora_evento", "ubicacion", "descripcion"):
        if field_name in changes:
            setattr(evento, field_name, changes[field_name])
    evento.fecha_actualizacion = datetime.now(timezone.utc)
    try:
        db.commit()
        db.refresh(evento)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error al actualizar evento") from exc
    return {"success": True, "event": evento}


@router.patch("/eventos/{id_evento}/estado", response_model=EventoActionResponse)
def update_estado_evento(
    id_evento: int,
    payload: EventoEstadoUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin_access),
) -> dict[str, bool | Evento]:
    evento = get_event(db, id_evento)
    assert_group_access(current_user, evento.id_grupo)
    evento.estado = normalize_event_status(payload.estado)
    evento.fecha_actualizacion = datetime.now(timezone.utc)
    try:
        db.commit()
        db.refresh(evento)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error al actualizar estado del evento") from exc
    return {"success": True, "event": evento}


@router.patch("/eventos/{id_evento}/ofrenda", response_model=OfrendaUpdateResponse)
def update_ofrenda(
    id_evento: int,
    payload: OfrendaUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin_access),
) -> dict[str, bool | int | Decimal]:
    if payload.ofrenda_global < 0:
        raise HTTPException(status_code=400, detail="ofrenda_global debe ser mayor o igual a 0")
    evento = get_event(db, id_evento)
    assert_group_access(current_user, evento.id_grupo)
    evento.ofrenda_global = payload.ofrenda_global
    try:
        db.commit()
        db.refresh(evento)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error al actualizar ofrenda") from exc
    return {"success": True, "id_evento": evento.id_evento, "ofrenda_global": evento.ofrenda_global}


@router.get("/eventos/{id_evento}/asistencia", response_model=EventAttendanceDetailResponse)
def get_evento_asistencia(
    id_evento: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin_access),
) -> dict[str, object]:
    evento = get_event(db, id_evento)
    assert_group_access(current_user, evento.id_grupo)
    grupo = get_group(db, evento.id_grupo)
    members = list(
        db.scalars(
            select(Miembro)
            .where(Miembro.id_grupo == evento.id_grupo, Miembro.estado == "ACTIVO")
            .order_by(Miembro.apellido, Miembro.nombre)
        ).all()
    )
    attendances = {
        asistencia.id_miembro: asistencia
        for asistencia in db.scalars(select(Asistencia).where(Asistencia.id_evento == id_evento)).all()
    }

    response_members: list[AttendanceMemberResponse] = []
    for miembro in members:
        asistencia = attendances.get(miembro.id_miembro)
        response_members.append(
            AttendanceMemberResponse(
                id_miembro=miembro.id_miembro,
                nombre=miembro.nombre,
                apellido=miembro.apellido,
                celular=miembro.celular,
                genero=miembro.genero,
                rio_de_dios=miembro.rio_de_dios,
                confirmacion=asistencia.confirmacion if asistencia else None,
                asistio=asistencia.asistio if asistencia else None,
            )
        )

    confirmaron = sum(1 for member in response_members if member.confirmacion == "ASISTIRA")
    confirmaron_no = sum(1 for member in response_members if member.confirmacion == "NO_ASISTIRA")
    asistieron = sum(1 for member in response_members if member.asistio == "SI")
    no_asistieron = sum(1 for member in response_members if member.asistio == "NO")
    pendientes = sum(1 for member in response_members if member.asistio is None)
    llegaron_sin_confirmar = sum(
        1 for member in response_members if member.asistio == "SI" and member.confirmacion != "ASISTIRA"
    )
    hombres = sum(1 for member in response_members if member.asistio == "SI" and (member.genero or "").strip() == "H")
    mujeres = sum(1 for member in response_members if member.asistio == "SI" and (member.genero or "").strip() == "M")
    nuevos = sum(1 for member in response_members if member.asistio == "SI" and member.rio_de_dios.strip() == "NUEVO")
    lideres = sum(1 for member in response_members if member.asistio == "SI" and member.rio_de_dios.strip() == "LIDER")
    tasa_asistencia = round((asistieron / len(members) * 100), 2) if members else 0.0

    return {
        "event": AttendanceEventResponse.model_validate(evento),
        "group": {"id_grupo": grupo.id_grupo, "nombre_grupo": grupo.nombre_grupo},
        "members": response_members,
        "metrics": AttendanceMetricsResponse(
            confirmaron=confirmaron,
            confirmaron_no=confirmaron_no,
            asistieron=asistieron,
            no_asistieron=no_asistieron,
            pendientes=pendientes,
            llegaron_sin_confirmar=llegaron_sin_confirmar,
            hombres=hombres,
            mujeres=mujeres,
            nuevos=nuevos,
            lideres=lideres,
            tasa_asistencia=tasa_asistencia,
        ),
    }
