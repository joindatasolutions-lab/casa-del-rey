from __future__ import annotations

import argparse
import getpass
import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal
from app.models.usuario import Usuario
from app.services.auth_service import hash_password

ROLES = {"SUPER_ADMIN", "LIDER_GRUPO"}


def main() -> None:
    parser = argparse.ArgumentParser(description="Crear o actualizar usuario administrador.")
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--role", required=True, choices=sorted(ROLES))
    parser.add_argument("--id-grupo", type=int, default=None)
    args = parser.parse_args()

    if args.role == "LIDER_GRUPO" and args.id_grupo is None:
        raise SystemExit("--id-grupo es requerido para LIDER_GRUPO")

    password = getpass.getpass("Password: ")
    confirm = getpass.getpass("Confirm password: ")
    if password != confirm:
        raise SystemExit("Las contrasenas no coinciden")
    if len(password) < 10:
        raise SystemExit("La contrasena debe tener al menos 10 caracteres")

    db = SessionLocal()
    try:
        usuario = db.scalars(select(Usuario).where(Usuario.email == args.email)).first()
        now = datetime.now(timezone.utc)
        if usuario is None:
            usuario = Usuario(
                email=args.email,
                nombre=args.name,
                password_hash=hash_password(password),
                rol=args.role,
                id_grupo=args.id_grupo,
                estado="ACTIVO",
                fecha_creacion=now,
                fecha_actualizacion=now,
            )
            db.add(usuario)
            action = "created"
        else:
            usuario.nombre = args.name
            usuario.password_hash = hash_password(password)
            usuario.rol = args.role
            usuario.id_grupo = args.id_grupo
            usuario.estado = "ACTIVO"
            usuario.fecha_actualizacion = now
            action = "updated"
        db.commit()
        db.refresh(usuario)
        print({"status": action, "id_usuario": usuario.id_usuario, "email": usuario.email, "rol": usuario.rol})
    finally:
        db.close()


if __name__ == "__main__":
    main()
