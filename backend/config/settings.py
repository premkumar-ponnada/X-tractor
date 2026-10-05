"""Application settings, loaded from environment variables / .env (prefix XT_)."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SECRET = "change-me-local-only-secret-key-0000"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_ROOT / ".env", env_prefix="XT_", extra="ignore", env_file_encoding="utf-8")

    app_env: Literal["local", "production"] = "local"
    log_level: str = "INFO"

    # Database
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_database: str = "xtractor"

    # Auth (single user for now; replaced by real auth later)
    auth_email: str = "demo@xtractor.dev"
    auth_password: SecretStr = SecretStr("demo1234")
    jwt_secret: SecretStr = SecretStr(DEFAULT_SECRET)
    jwt_ttl_minutes: int = Field(default=480, ge=5, le=60 * 24 * 7)
    cookie_name: str = "xt_session"
    cookie_secure: bool = False

    # HTTP
    cors_origins: str = "http://localhost:5173"

    # Uploads and storage
    storage_dir: Path = BACKEND_ROOT / "storage"
    max_file_mb: int = Field(default=100, ge=1)
    max_files_per_job: int = Field(default=50, ge=1)

    # Containers (zip) safety limits
    zip_max_entries: int = 500
    zip_max_total_mb: int = 1000
    zip_max_depth: int = 3
    zip_max_ratio: int = 200

    # Extraction
    tika_url: str = "http://localhost:9998"
    tesseract_cmd: str = "tesseract"
    ocr_languages: str = "swe+eng"
    run_timeout_seconds: int = Field(default=900, ge=30)

    # Worker
    worker_poll_seconds: float = 1.0
    worker_heartbeat_seconds: int = 10
    worker_stale_seconds: int = 120
    worker_processes: int = Field(default=1, ge=1, le=8)
    job_max_attempts: int = 3

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def max_file_bytes(self) -> int:
        return self.max_file_mb * 1024 * 1024

    @model_validator(mode="after")
    def _production_guards(self) -> "Settings":
        if self.is_production:
            problems = []
            if self.jwt_secret.get_secret_value() == DEFAULT_SECRET or len(self.jwt_secret.get_secret_value()) < 32:
                problems.append("XT_JWT_SECRET must be set to a random value of at least 32 characters")
            if not self.cookie_secure:
                problems.append("XT_COOKIE_SECURE must be true in production")
            if self.auth_password.get_secret_value() in {"demo1234", ""}:
                problems.append("XT_AUTH_PASSWORD must be changed in production")
            if "*" in self.cors_origin_list:
                problems.append("XT_CORS_ORIGINS must not be '*' in production")
            if problems:
                raise ValueError("Unsafe production settings: " + "; ".join(problems))
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
