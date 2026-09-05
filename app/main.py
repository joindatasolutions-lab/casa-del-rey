from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.middleware import request_logging_middleware
from app.routers import asistencias, auth, eventos, grupos, health, miembros

settings = get_settings()
app = FastAPI(title="Casa del Rey API", version="0.1.0")
app.middleware("http")(request_logging_middleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router, prefix="/api")
app.include_router(grupos.router, prefix="/api")
app.include_router(miembros.router, prefix="/api")
app.include_router(eventos.router, prefix="/api")
app.include_router(asistencias.router, prefix="/api")
