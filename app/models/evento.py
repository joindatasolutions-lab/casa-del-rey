from __future__ import annotations

from datetime import date, datetime, time
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Numeric, String, Text, Time, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.asistencia import Asistencia
    from app.models.grupo import Grupo


class Evento(Base):
    __tablename__ = "eventos"
    __table_args__ = {"schema": "casa_del_rey"}

    id_evento: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    id_grupo: Mapped[int] = mapped_column(ForeignKey("casa_del_rey.grupos.id_grupo"), nullable=False)
    nombre_evento: Mapped[str] = mapped_column(String, nullable=False)
    fecha_evento: Mapped[date] = mapped_column(Date, nullable=False)
    hora_evento: Mapped[time | None] = mapped_column(Time)
    ubicacion: Mapped[str | None] = mapped_column(Text)
    descripcion: Mapped[str | None] = mapped_column(Text)
    ofrenda_global: Mapped[Decimal] = mapped_column(Numeric, nullable=False, server_default=text("0"))
    estado: Mapped[str] = mapped_column(String, nullable=False, server_default=text("'ACTIVO'"))
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    fecha_actualizacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))

    grupo: Mapped[Grupo] = relationship(back_populates="eventos")
    asistencias: Mapped[list[Asistencia]] = relationship(back_populates="evento")
