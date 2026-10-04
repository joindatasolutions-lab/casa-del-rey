"""Phone identification for attendance only; never grants administrator access."""
from dataclasses import dataclass

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import security
from app.models.grupo import Grupo
from app.models.miembro import Miembro
from app.models.usuario import Usuario
from app.routers.asistencias import confirmar_asistencia
from app.routers.miembros import create_miembro
from app.schemas.asistencia import AttendanceActionResponse, AttendanceConfirmRequest
from app.schemas.evento import EventoResponse
from app.schemas.grupo import GrupoResponse
from app.schemas.miembro import MiembroCreate, MiembroCreateResponse, MiembroPublicResponse
from app.services.auth_service import create_access_token, decode_access_token
from app.services.eventos_service import get_next_group_event
from app.services.miembros_service import get_active_group, require_valid_phone

router = APIRouter(prefix="/public", tags=["public"])


class PhoneRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    celular: str


class VisitorResponse(BaseModel):
    celular: str
    exists: bool
    id_grupo: int | None
    member: MiembroPublicResponse | None


class IdentificationResponse(BaseModel):
    access_token: str
    user: VisitorResponse


@dataclass
class Visitor:
    celular: str
    member: Miembro | None

    def response(self):
        return VisitorResponse(
            celular=self.celular, exists=self.member is not None,
            id_grupo=self.member.id_grupo if self.member else None,
            member=MiembroPublicResponse.model_validate(self.member) if self.member else None,
        )

    def check_group(self, group_id):
        if self.member and self.member.id_grupo != group_id:
            raise HTTPException(status_code=403, detail="Este no es tu grupo asignado")


def find_visitor(db: Session, phone: str) -> Visitor:
    normalized = Miembro.celular
    for separator in (" ", "+", "-", "(", ")", "."):
        normalized = func.replace(normalized, separator, "")
    members = db.scalars(select(Miembro).where(normalized.in_([phone, "57" + phone])).limit(2)).all()
    if len(members) > 1:
        raise HTTPException(status_code=409, detail="El celular tiene varios registros. Contacta al responsable de tu grupo.")
    member = members[0] if members else None
    if member and member.estado != "ACTIVO":
        raise HTTPException(status_code=403, detail="Tu registro esta inactivo. Contacta al responsable de tu grupo.")
    return Visitor(phone, member)


def get_visitor(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> Visitor:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Ingresa tu celular para continuar")
    claims = decode_access_token(credentials.credentials)
    if claims.get("scope") != "public_attendance" or not isinstance(claims.get("celular"), str):
        raise HTTPException(status_code=401, detail="Identificacion invalida")
    return find_visitor(db, require_valid_phone(claims["celular"]))


@router.post("/identificar", response_model=IdentificationResponse)
def identify(payload: PhoneRequest, db: Session = Depends(get_db)):
    phone = require_valid_phone(payload.celular)
    visitor = find_visitor(db, phone)
    token = create_access_token("public:" + phone, {"scope": "public_attendance", "celular": phone})
    return IdentificationResponse(access_token=token, user=visitor.response())


@router.get("/me", response_model=VisitorResponse)
def me(visitor: Visitor = Depends(get_visitor)):
    return visitor.response()


@router.get("/grupos", response_model=list[GrupoResponse])
def groups(visitor: Visitor = Depends(get_visitor), db: Session = Depends(get_db)):
    query = select(Grupo).where(Grupo.estado == "ACTIVO").order_by(Grupo.nombre_grupo)
    if visitor.member:
        query = query.where(Grupo.id_grupo == visitor.member.id_grupo)
    return list(db.scalars(query))


@router.get("/grupos/{slug}", response_model=GrupoResponse)
def group(slug: str, visitor: Visitor = Depends(get_visitor), db: Session = Depends(get_db)):
    item = db.scalars(select(Grupo).where(Grupo.slug == slug, Grupo.estado == "ACTIVO")).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    visitor.check_group(item.id_grupo)
    return item


@router.get("/grupos/{group_id}/eventos/proximo", response_model=EventoResponse)
def next_event(group_id: int, visitor: Visitor = Depends(get_visitor), db: Session = Depends(get_db)):
    visitor.check_group(group_id)
    return get_next_group_event(db, group_id)


@router.post("/miembros", response_model=MiembroCreateResponse, status_code=201)
def register(payload: MiembroCreate, visitor: Visitor = Depends(get_visitor), db: Session = Depends(get_db)):
    if require_valid_phone(payload.celular) != visitor.celular:
        raise HTTPException(status_code=403, detail="Usa el celular que ingresaste")
    visitor.check_group(payload.id_grupo)
    get_active_group(db, payload.id_grupo)
    if visitor.member:
        return {"success": True, "exists": True, "member": visitor.member}
    # Reuse the existing validated creation flow only after checking the visitor's scope.
    return create_miembro(payload, db, Usuario(rol="LIDER_GRUPO", id_grupo=payload.id_grupo))


@router.post("/asistencias/confirmar", response_model=AttendanceActionResponse)
def confirm(payload: AttendanceConfirmRequest, visitor: Visitor = Depends(get_visitor), db: Session = Depends(get_db)):
    if visitor.member is None or payload.id_miembro != visitor.member.id_miembro:
        raise HTTPException(status_code=403, detail="Solo puedes confirmar tu propia asistencia")
    return confirmar_asistencia(payload, db, Usuario(rol="LIDER_GRUPO", id_grupo=visitor.member.id_grupo))
