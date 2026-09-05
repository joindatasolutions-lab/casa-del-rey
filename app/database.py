from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


settings = get_settings()


class Base(DeclarativeBase):
    pass


def build_database_url() -> URL:
    if settings.db_host.startswith("/"):
        return URL.create(
            drivername="postgresql+psycopg",
            username=settings.db_user,
            password=settings.db_password,
            database=settings.db_name,
            query={"host": settings.db_host, "port": str(settings.db_port)},
        )

    return URL.create(
        drivername="postgresql+psycopg",
        username=settings.db_user,
        password=settings.db_password,
        host=settings.db_host,
        port=settings.db_port,
        database=settings.db_name,
    )


database_url = build_database_url()

engine = create_engine(database_url, pool_pre_ping=True, hide_parameters=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
