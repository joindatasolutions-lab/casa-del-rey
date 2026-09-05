from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    db_host: str | None = None
    db_port: int | None = 5432
    db_instance_connection_name: str | None = None
    db_name: str
    db_user: str
    db_password: str = Field(min_length=1)
    db_schema: str
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480

    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("db_schema")
    @classmethod
    def validate_db_schema(cls, value: str) -> str:
        if value != "casa_del_rey":
            raise ValueError("DB_SCHEMA must be casa_del_rey")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
