from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[3]
ENV_FILE = PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = Field(default="Meeting Room Booking", alias="APP_NAME")
    app_env: str = Field(default="development", alias="APP_ENV")
    app_debug: bool = Field(default=True, alias="APP_DEBUG")
    api_v1_prefix: str = Field(default="/api/v1", alias="API_V1_PREFIX")
    secret_key: str = Field(alias="SECRET_KEY")
    access_token_expire_minutes: int = Field(
        default=60,
        alias="ACCESS_TOKEN_EXPIRE_MINUTES",
    )
    algorithm: str = Field(default="HS256", alias="ALGORITHM")

    backend_host: str = Field(default="0.0.0.0", alias="BACKEND_HOST")
    backend_port: int = Field(default=8000, alias="BACKEND_PORT")
    backend_cors_origins: str = Field(
        default="",
        alias="BACKEND_CORS_ORIGINS",
    )

    postgres_host: str = Field(default="localhost", alias="POSTGRES_HOST")
    postgres_port: int = Field(default=5432, alias="POSTGRES_PORT")
    postgres_db: str = Field(default="meeting_room_booking", alias="POSTGRES_DB")
    postgres_user: str = Field(default="postgres", alias="POSTGRES_USER")
    postgres_password: str = Field(default="postgres", alias="POSTGRES_PASSWORD")
    postgres_schema: str = Field(default="public", alias="POSTGRES_SCHEMA")
    database_url: str | None = Field(default=None, alias="DATABASE_URL")

    worker_poll_interval_seconds: int = Field(
        default=5,
        alias="WORKER_POLL_INTERVAL_SECONDS",
    )
    worker_batch_size: int = Field(default=20, alias="WORKER_BATCH_SIZE")
    outbox_max_attempts: int = Field(default=5, alias="OUTBOX_MAX_ATTEMPTS")
    outbox_retry_delay_seconds: int = Field(
        default=30,
        alias="OUTBOX_RETRY_DELAY_SECONDS",
    )
    mailer_from_email: str = Field(
        default="no-reply@meeting-room-booking.local",
        alias="MAILER_FROM_EMAIL",
    )
    mailer_provider: str = Field(default="console", alias="MAILER_PROVIDER")

    initial_user_email: str = Field(
        default="admin@meeting-room-booking.local",
        alias="INITIAL_USER_EMAIL",
    )
    initial_user_full_name: str = Field(
        default="Admin User",
        alias="INITIAL_USER_FULL_NAME",
    )
    initial_user_password: str = Field(
        default="change-this-password",
        alias="INITIAL_USER_PASSWORD",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.backend_cors_origins.split(",")
            if origin.strip()
        ]

    @property
    def resolved_database_url(self) -> str:
        if self.database_url:
            return self.database_url

        return (
            "postgresql+psycopg://"
            f"{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
