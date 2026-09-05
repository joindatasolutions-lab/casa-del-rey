from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.evento import Evento
from app.models.grupo import Grupo

COLOMBIA_TZ = ZoneInfo("America/Bogota")


def generate_future_events(db: Session, semanas: int = 12) -> dict[str, int | bool]:
    if semanas < 1 or semanas > 52:
        raise ValueError("semanas debe estar entre 1 y 52")

    today = datetime.now(COLOMBIA_TZ).date()
    created = 0
    existing = 0
    groups_processed = 0

    groups = list(
        db.scalars(
            select(Grupo)
            .where(Grupo.estado == "ACTIVO", Grupo.dia_semana.is_not(None), Grupo.hora.is_not(None))
            .order_by(Grupo.id_grupo)
        ).all()
    )

    for grupo in groups:
        groups_processed += 1
        target_weekday = int(grupo.dia_semana)
        days_until = (target_weekday - today.isoweekday()) % 7
        first_date = today + timedelta(days=days_until)
        for index in range(semanas):
            event_date = first_date + timedelta(days=index * 7)
            event_exists = db.scalars(
                select(Evento).where(Evento.id_grupo == grupo.id_grupo, Evento.fecha_evento == event_date)
            ).first()
            if event_exists is not None:
                existing += 1
                continue
            db.add(
                Evento(
                    id_grupo=grupo.id_grupo,
                    nombre_evento=grupo.nombre_grupo,
                    fecha_evento=event_date,
                    hora_evento=grupo.hora,
                    ubicacion=grupo.ubicacion,
                    descripcion=grupo.descripcion,
                    estado="ACTIVO",
                )
            )
            created += 1

    return {"success": True, "created": created, "existing": existing, "groups_processed": groups_processed}
