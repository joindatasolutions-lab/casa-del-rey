from __future__ import annotations

import csv
import sys
from datetime import datetime
from pathlib import Path

from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import engine

DATA_FILE = Path(__file__).resolve().parents[1] / "data" / "asistencias_red_solteros_1.csv"

LEGACY_MEMBER_PHONE = {
    "MIEMBRO_fdcc9309-b108-4b28-9ff5-8d7506d270fe": "3128896624",
    "MIEMBRO_7cbbc1ef-2ec5-4bcd-8415-0fffb0dae397": "3104690920",
    "MIEMBRO_3a2d59fa-ec90-4b20-b4da-e8e58e71c917": "3058979625",
    "MIEMBRO_e3e47272-f06a-4102-a727-ff1923355e77": "3505507414",
    "MIEMBRO_eff02eea-0c03-4924-a6e5-dd0d04964881": "3008331241",
    "MIEMBRO_5816c346-596f-4467-9030-5b383460636c": "3165776060",
    "MIEMBRO_e534528d-024f-4b1f-a667-274bbd84696b": "3244166783",
    "MIEMBRO_69a57cf8-5e73-430a-9f58-0bd2a74d567c": "3012546857",
    "MIEMBRO_3684b8d4-2369-4b6e-a543-6ac4d4e336e7": "3004386100",
    "MIEMBRO_04738975-35fa-4392-ac06-29da5fc25572": "3146480094",
    "MIEMBRO_b3006664-3bd5-415c-922a-20520ea804d6": "3217792020",
    "MIEMBRO_a674c905-d262-414c-973e-73e5e4f5ee8a": "3023741189",
    "MIEMBRO_94acb13d-b147-4637-896b-dceefadb3582": "3116117358",
    "MIEMBRO_e63a7eac-11c3-4d24-b687-ee51cdcb247e": "3186045592",
    "MIEMBRO_449e7bd0-6807-4c7a-80e8-d7a46391bf4a": "3002062838",
    "MIEMBRO_a264f421-5480-44d7-bf4d-7f31ae44a9fa": "3004387047",
    "MIEMBRO_c8c4196f-5b28-4ebe-8bf9-5e2fddc434e0": "3246840547",
    "MIEMBRO_0821f7cb-2557-4d36-9cf4-6451a35f8c71": "3014001613",
    "MIEMBRO_57fed07b-aeed-4b11-a8ac-72569ac9dc27": "3106152689",
    "MIEMBRO_60ddb662-68c4-4fa5-8397-62240b37147c": "3018663698",
    "MIEMBRO_e10e09e2-da7e-421c-9b97-e94e2e13c89a": "3015272801",
    "MIEMBRO_d17376df-283f-49f0-8f29-bd7c79edcb7e": "3147445868",
    "MIEMBRO_e1e47192-3eeb-4525-91f3-57d25014f3cf": "3016778914",
    "MIEMBRO_6f8616ed-d167-4571-9a98-a2551b8037ed": "3104949528",
    "MIEMBRO_1ae2d20c-7a80-400a-9869-2e438e3135f1": "3215383345",
    "MIEMBRO_dfd85bb5-dca3-452c-85f2-83a01d589316": "3024049453",
}

LEGACY_EVENT_DATE = {
    "EVENTO_8005b2b5-d2a8-4ce4-9914-233421937cb3": "2026-08-26",
    "EVENTO_7bd1d115-c00c-468f-b7a5-16ed3136931d": "2026-09-02",
}


def parse_datetime(value: str) -> datetime | None:
    if not value.strip():
        return None
    return datetime.strptime(value.strip(), "%d/%m/%Y %H:%M:%S")


def normalize_optional(value: str) -> str | None:
    cleaned = value.strip()
    return cleaned or None


def main() -> None:
    with DATA_FILE.open(newline="", encoding="utf-8") as source:
        rows = list(csv.DictReader(source))

    inserted = 0
    updated = 0
    skipped = 0

    with engine.begin() as conn:
        id_grupo = conn.execute(
            text(
                """
                select id_grupo
                from casa_del_rey.grupos
                where slug = 'red-solteros-1'
                limit 1
                """
            )
        ).scalar_one_or_none()
        if id_grupo is None:
            raise RuntimeError("No existe el grupo red-solteros-1")

        for row in rows:
            phone = LEGACY_MEMBER_PHONE.get(row["id_miembro_legacy"])
            event_date = LEGACY_EVENT_DATE.get(row["id_evento_legacy"])
            if phone is None or event_date is None:
                skipped += 1
                continue

            id_miembro = conn.execute(
                text(
                    """
                    select id_miembro
                    from casa_del_rey.miembros
                    where id_grupo = :id_grupo and celular = :celular
                    limit 1
                    """
                ),
                {"id_grupo": id_grupo, "celular": phone},
            ).scalar_one_or_none()

            id_evento = conn.execute(
                text(
                    """
                    select id_evento
                    from casa_del_rey.eventos
                    where id_grupo = :id_grupo
                      and fecha_evento = :fecha_evento
                      and nombre_evento = 'Grupo de Oracion Red Solteros'
                    limit 1
                    """
                ),
                {"id_grupo": id_grupo, "fecha_evento": event_date},
            ).scalar_one_or_none()

            if id_miembro is None or id_evento is None:
                skipped += 1
                continue

            params = {
                "id_miembro": id_miembro,
                "id_evento": id_evento,
                "confirmacion": normalize_optional(row["confirmacion"]),
                "asistio": normalize_optional(row["asistio"]),
                "fecha_confirmacion": parse_datetime(row["fecha_confirmacion"]),
                "fecha_actualizacion": parse_datetime(row["fecha_actualizacion"]),
            }

            existing_id = conn.execute(
                text(
                    """
                    select id_asistencia
                    from casa_del_rey.asistencias
                    where id_miembro = :id_miembro and id_evento = :id_evento
                    limit 1
                    """
                ),
                params,
            ).scalar_one_or_none()

            if existing_id is None:
                conn.execute(
                    text(
                        """
                        insert into casa_del_rey.asistencias (
                            id_miembro, id_evento, confirmacion, asistio,
                            fecha_confirmacion, fecha_actualizacion
                        ) values (
                            :id_miembro, :id_evento, :confirmacion, :asistio,
                            :fecha_confirmacion, :fecha_actualizacion
                        )
                        """
                    ),
                    params,
                )
                inserted += 1
            else:
                conn.execute(
                    text(
                        """
                        update casa_del_rey.asistencias
                        set confirmacion = :confirmacion,
                            asistio = :asistio,
                            fecha_confirmacion = :fecha_confirmacion,
                            fecha_actualizacion = :fecha_actualizacion
                        where id_asistencia = :id_asistencia
                        """
                    ),
                    {**params, "id_asistencia": existing_id},
                )
                updated += 1

    print({"source_rows": len(rows), "inserted": inserted, "updated": updated, "skipped": skipped})


if __name__ == "__main__":
    main()
