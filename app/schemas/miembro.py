from datetime import date

from pydantic import BaseModel, ConfigDict


FORBID_EXTRA = ConfigDict(extra="forbid")


class MiembroPublicResponse(BaseModel):
    id_miembro: int
    nombre: str
    apellido: str

    model_config = ConfigDict(from_attributes=True)


class MiembroRioResponse(MiembroPublicResponse):
    rio_de_dios: str


class MiembroCreate(BaseModel):
    model_config = FORBID_EXTRA

    id_grupo: int
    nombre: str
    apellido: str
    fecha_nacimiento: date | None = None
    genero: str
    celular: str
    direccion: str | None = None
    contacto_emergencia: str | None = None
    telefono_emergencia: str | None = None


class MiembroUpdate(BaseModel):
    model_config = FORBID_EXTRA

    nombre: str | None = None
    apellido: str | None = None
    fecha_nacimiento: date | None = None
    genero: str | None = None
    celular: str | None = None
    direccion: str | None = None
    contacto_emergencia: str | None = None
    telefono_emergencia: str | None = None


class MiembroAdminResponse(BaseModel):
    id_miembro: int
    id_grupo: int
    nombre: str
    apellido: str
    fecha_nacimiento: date | None
    genero: str | None
    celular: str
    direccion: str | None
    contacto_emergencia: str | None
    telefono_emergencia: str | None
    rio_de_dios: str
    estado: str

    model_config = ConfigDict(from_attributes=True)


class MiembroUpdateResponse(BaseModel):
    success: bool
    member: MiembroAdminResponse


class MiembroCreateResponse(BaseModel):
    success: bool
    exists: bool
    member: MiembroPublicResponse


class MiembroSearchResponse(BaseModel):
    exists: bool
    member: MiembroPublicResponse | None


class RioDeDiosUpdate(BaseModel):
    model_config = FORBID_EXTRA

    rio_de_dios: str


class RioDeDiosUpdateResponse(BaseModel):
    success: bool
    member: MiembroRioResponse


class MiembroEstadoUpdate(BaseModel):
    model_config = FORBID_EXTRA

    estado: str


class MiembroEstadoUpdateResponse(BaseModel):
    success: bool
    member: MiembroAdminResponse
