from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.evento import Evento
    from app.models.miembro import Miembro


class Asistencia(Base):
    __tablename__ = "asistencias"
    __table_args__ = {"schema": "casa_del_rey"}

    id_asistencia: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    id_miembro: Mapped[int] = mapped_column(ForeignKey("casa_del_rey.miembros.id_miembro"), nullable=False)
    id_evento: Mapped[int] = mapped_column(ForeignKey("casa_del_rey.eventos.id_evento"), nullable=False)
    confirmacion: Mapped[str | None] = mapped_column(String)
    asistio: Mapped[str | None] = mapped_column(String)
    fecha_confirmacion: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    fecha_actualizacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))

    miembro: Mapped[Miembro] = relationship(back_populates="asistencias")
    evento: Mapped[Evento] = relationship(back_populates="asistencias")
