from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "sqlite:///./finwise_dev.db"
    MIGRATION_DATABASE_URL: str | None = None
    SESSION_SECRET: str = "local-development-only-change-this-secret"
    APP_ENV: str = "development"
    PUBLIC_ORIGIN: str = "http://localhost:8000"
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    MAIL_FROM: str | None = None

    @property
    def production(self) -> bool:
        return self.APP_ENV == "production"

    def validate_production(self) -> None:
        if not self.production:
            return
        if len(self.SESSION_SECRET) < 32 or self.SESSION_SECRET.startswith("local-development"):
            raise RuntimeError("SESSION_SECRET must be a strong production secret")
        if not self.DATABASE_URL.startswith("postgresql") or not self.MIGRATION_DATABASE_URL:
            raise RuntimeError("Production requires pooled and direct PostgreSQL URLs")
        runtime_url = make_url(self.DATABASE_URL)
        migration_url = make_url(self.MIGRATION_DATABASE_URL)
        if runtime_url.query.get("sslmode") != "require" or migration_url.query.get("sslmode") != "require":
            raise RuntimeError("Neon connections must require TLS")
        if "-pooler" not in (runtime_url.host or "") or "-pooler" in (migration_url.host or ""):
            raise RuntimeError("Use pooled Neon URL for requests and direct URL for migrations")
        if not self.PUBLIC_ORIGIN.startswith("https://"):
            raise RuntimeError("PUBLIC_ORIGIN must use HTTPS in production")
        if not all((self.SMTP_HOST, self.SMTP_USER, self.SMTP_PASSWORD, self.MAIL_FROM)):
            raise RuntimeError("Production requires password-reset email configuration")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
