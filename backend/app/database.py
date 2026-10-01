from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings, sqlalchemy_database_url


class Base(DeclarativeBase):
    pass


connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(
    sqlalchemy_database_url(settings.DATABASE_URL),
    connect_args=connect_args,
    pool_pre_ping=True,
    **({"pool_size": 3, "max_overflow": 2} if not connect_args else {}),
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
