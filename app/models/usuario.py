from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.grupo import Grupo


class Usuario(Base):
    __tablename__ = "usuarios"
    __table_args__ = {"schema": "casa_del_rey"}

    id_usuario: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    id_grupo: Mapped[int | None] = mapped_column(ForeignKey("casa_del_rey.grupos.id_grupo"))
    nombre: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    rol: Mapped[str] = mapped_column(String, nullable=False)
    estado: Mapped[str] = mapped_column(String, nullable=False)
    ultimo_acceso: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    fecha_creacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    fecha_actualizacion: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    grupo: Mapped[Grupo | None] = relationship(back_populates="usuarios")
