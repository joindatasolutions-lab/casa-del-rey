from pydantic import BaseModel, ConfigDict


class AttendanceConfirmRequest(BaseModel):
    id_miembro: int
    id_evento: int
    confirmacion: str


class AttendanceMarkRequest(BaseModel):
    id_miembro: int
    id_evento: int
    asistio: str


class AttendanceResponse(BaseModel):
    id_miembro: int
    id_evento: int
    confirmacion: str | None
    asistio: str | None

    model_config = ConfigDict(from_attributes=True)


class AttendanceActionResponse(BaseModel):
    success: bool
    attendance: AttendanceResponse
