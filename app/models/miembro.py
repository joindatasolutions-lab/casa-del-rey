from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.asistencia import Asistencia
    from app.models.grupo import Grupo


class Miembro(Base):
    __tablename__ = "miembros"
    __table_args__ = {"schema": "casa_del_rey"}

    id_miembro: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    id_grupo: Mapped[int] = mapped_column(ForeignKey("casa_del_rey.grupos.id_grupo"), nullable=False)
    nombre: Mapped[str] = mapped_column(String, nullable=False)
    apellido: Mapped[str] = mapped_column(String, nullable=False)
    fecha_nacimiento: Mapped[date | None] = mapped_column(Date)
    genero: Mapped[str | None] = mapped_column(String(1))
    celular: Mapped[str] = mapped_column(String, nullable=False)
    direccion: Mapped[str | None] = mapped_column(Text)
    contacto_emergencia: Mapped[str | None] = mapped_column(String)
    telefono_emergencia: Mapped[str | None] = mapped_column(String)
    rio_de_dios: Mapped[str] = mapped_column(String, nullable=False, server_default=text("'NUEVO'"))
    estado: Mapped[str] = mapped_column(String, nullable=False, server_default=text("'ACTIVO'"))
    fecha_registro: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    fecha_actualizacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))

    grupo: Mapped[Grupo] = relationship(back_populates="miembros")
    asistencias: Mapped[list[Asistencia]] = relationship(back_populates="miembro")
