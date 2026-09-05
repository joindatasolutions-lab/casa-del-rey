from datetime import datetime, time

from pydantic import BaseModel, ConfigDict

FORBID_EXTRA = ConfigDict(extra="forbid")


class GrupoResponse(BaseModel):
    id_grupo: int
    nombre_grupo: str
    slug: str
    dia_semana: int | None
    hora: time | None
    ubicacion: str | None
    descripcion: str | None
    responsable: str | None
    estado: str
    fecha_creacion: datetime
    fecha_actualizacion: datetime

    model_config = ConfigDict(from_attributes=True)


class GrupoCreate(BaseModel):
    model_config = FORBID_EXTRA

    nombre_grupo: str
    slug: str
    dia_semana: int | None = None
    hora: time | None = None
    ubicacion: str | None = None
    descripcion: str | None = None
    responsable: str | None = None


class GrupoUpdate(BaseModel):
    model_config = FORBID_EXTRA

    nombre_grupo: str | None = None
    slug: str | None = None
    dia_semana: int | None = None
    hora: time | None = None
    ubicacion: str | None = None
    descripcion: str | None = None
    responsable: str | None = None


class GrupoEstadoUpdate(BaseModel):
    model_config = FORBID_EXTRA

    estado: str


class GrupoActionResponse(BaseModel):
    success: bool
    group: GrupoResponse
