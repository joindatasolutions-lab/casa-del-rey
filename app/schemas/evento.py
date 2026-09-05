from datetime import date, time
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class EventoResponse(BaseModel):
    id_evento: int
    id_grupo: int
    nombre_evento: str
    fecha_evento: date
    hora_evento: time | None
    ubicacion: str | None
    descripcion: str | None
    ofrenda_global: Decimal
    estado: str

    model_config = ConfigDict(from_attributes=True)


class EventoCreate(BaseModel):
    id_grupo: int
    nombre_evento: str
    fecha_evento: date
    hora_evento: time | None = None
    ubicacion: str | None = None
    descripcion: str | None = None
    ofrenda_global: Decimal = Decimal("0")
    estado: str = "ACTIVO"


class EventoUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nombre_evento: str | None = None
    fecha_evento: date | None = None
    hora_evento: time | None = None
    ubicacion: str | None = None
    descripcion: str | None = None


class EventoEstadoUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    estado: str


class EventoActionResponse(BaseModel):
    success: bool
    event: EventoResponse


class GenerateEventsRequest(BaseModel):
    semanas: int = 12


class GenerateEventsResponse(BaseModel):
    success: bool
    created: int
    existing: int
    groups_processed: int


class OfrendaUpdate(BaseModel):
    ofrenda_global: Decimal


class OfrendaUpdateResponse(BaseModel):
    success: bool
    id_evento: int
    ofrenda_global: Decimal


class AttendanceEventResponse(BaseModel):
    id_evento: int
    id_grupo: int
    nombre_evento: str
    fecha_evento: date
    hora_evento: time | None
    ubicacion: str | None
    ofrenda_global: Decimal

    model_config = ConfigDict(from_attributes=True)


class AttendanceMemberResponse(BaseModel):
    id_miembro: int
    nombre: str
    apellido: str
    celular: str
    genero: str | None
    rio_de_dios: str
    confirmacion: str | None
    asistio: str | None


class AttendanceMetricsResponse(BaseModel):
    confirmaron: int
    confirmaron_no: int
    asistieron: int
    no_asistieron: int
    pendientes: int
    llegaron_sin_confirmar: int
    hombres: int
    mujeres: int
    nuevos: int
    lideres: int
    tasa_asistencia: float


class AttendanceGroupResponse(BaseModel):
    id_grupo: int
    nombre_grupo: str


class EventAttendanceDetailResponse(BaseModel):
    event: AttendanceEventResponse
    group: AttendanceGroupResponse
    members: list[AttendanceMemberResponse]
    metrics: AttendanceMetricsResponse
