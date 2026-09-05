from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.usuario import Usuario
from app.services.auth_service import decode_access_token

security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> Usuario:
    if credentials is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Token invalido")
    usuario = db.get(Usuario, int(user_id))
    if usuario is None or usuario.estado != "ACTIVO":
        raise HTTPException(status_code=401, detail="Usuario no autorizado")
    return usuario


def require_super_admin(current_user: Usuario = Depends(get_current_user)) -> Usuario:
    if current_user.rol != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Sin permiso")
    return current_user


def require_admin_access(current_user: Usuario = Depends(get_current_user)) -> Usuario:
    if current_user.rol not in {"SUPER_ADMIN", "LIDER_GRUPO"}:
        raise HTTPException(status_code=403, detail="Sin permiso")
    return current_user


def assert_group_access(current_user: Usuario, id_grupo: int) -> None:
    if current_user.rol == "SUPER_ADMIN":
        return
    if current_user.rol == "LIDER_GRUPO" and current_user.id_grupo == id_grupo:
        return
    raise HTTPException(status_code=403, detail="Sin permiso para este grupo")
