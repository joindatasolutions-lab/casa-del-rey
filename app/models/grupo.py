from __future__ import annotations

from datetime import datetime, time
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, SmallInteger, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.evento import Evento
    from app.models.miembro import Miembro
    from app.models.usuario import Usuario


class Grupo(Base):
    __tablename__ = "grupos"
    __table_args__ = {"schema": "casa_del_rey"}

    id_grupo: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    nombre_grupo: Mapped[str] = mapped_column(String, nullable=False)
    slug: Mapped[str] = mapped_column(String, nullable=False)
    dia_semana: Mapped[int | None] = mapped_column(SmallInteger)
    hora: Mapped[time | None] = mapped_column(Time)
    ubicacion: Mapped[str | None] = mapped_column(Text)
    descripcion: Mapped[str | None] = mapped_column(Text)
    responsable: Mapped[str | None] = mapped_column(String)
    estado: Mapped[str] = mapped_column(String, nullable=False)
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    fecha_actualizacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    miembros: Mapped[list[Miembro]] = relationship(back_populates="grupo")
    eventos: Mapped[list[Evento]] = relationship(back_populates="grupo")
    usuarios: Mapped[list[Usuario]] = relationship(back_populates="grupo")
