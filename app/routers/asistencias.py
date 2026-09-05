from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import assert_group_access, require_admin_access
from app.models.usuario import Usuario
from app.schemas.asistencia import AttendanceActionResponse, AttendanceConfirmRequest, AttendanceMarkRequest
from app.services.asistencias_service import (
    ATTENDANCE_VALUES,
    CONFIRMATION_VALUES,
    get_or_create_attendance,
    normalize_choice,
    now_utc,
    validate_member_event,
)

router = APIRouter(prefix="/asistencias", tags=["asistencias"])


@router.post("/confirmar", response_model=AttendanceActionResponse)
def confirmar_asistencia(payload: AttendanceConfirmRequest, db: Session = Depends(get_db)) -> dict[str, object]:
    validate_member_event(db, payload.id_miembro, payload.id_evento)
    confirmacion = normalize_choice(payload.confirmacion, CONFIRMATION_VALUES, "confirmacion")
    asistencia = get_or_create_attendance(db, payload.id_miembro, payload.id_evento)
    asistencia.confirmacion = confirmacion
    asistencia.fecha_confirmacion = now_utc()
    asistencia.fecha_actualizacion = now_utc()
    try:
        db.commit()
        db.refresh(asistencia)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error al confirmar asistencia") from exc
    return {"success": True, "attendance": asistencia}


@router.patch("/marcar", response_model=AttendanceActionResponse)
def marcar_asistencia(
    payload: AttendanceMarkRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_admin_access),
) -> dict[str, object]:
    miembro, evento = validate_member_event(db, payload.id_miembro, payload.id_evento)
    assert_group_access(current_user, miembro.id_grupo)
    assert_group_access(current_user, evento.id_grupo)
    asistio = normalize_choice(payload.asistio, ATTENDANCE_VALUES, "asistio")
    asistencia = get_or_create_attendance(db, payload.id_miembro, payload.id_evento)
    asistencia.asistio = asistio
    asistencia.fecha_actualizacion = now_utc()
    try:
        db.commit()
        db.refresh(asistencia)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error al marcar asistencia") from exc
    return {"success": True, "attendance": asistencia}
