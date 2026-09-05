from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.usuario import Usuario
from app.schemas.auth import AuthUserResponse, LoginRequest, LoginResponse
from app.services.auth_service import create_access_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    usuario = db.scalars(select(Usuario).where(Usuario.email == payload.email)).first()
    if usuario is None or usuario.estado != "ACTIVO" or not verify_password(payload.password, usuario.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales invalidas")
    usuario.ultimo_acceso = datetime.now(timezone.utc)
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
    token = create_access_token(
        str(usuario.id_usuario),
        {"rol": usuario.rol, "id_grupo": usuario.id_grupo, "email": usuario.email},
    )
    return LoginResponse(access_token=token, user=AuthUserResponse.model_validate(usuario))


@router.get("/me", response_model=AuthUserResponse)
def me(current_user: Usuario = Depends(get_current_user)) -> Usuario:
    return current_user
