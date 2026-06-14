"""Application configuration.

Settings are loaded from environment variables (and an optional .env file)
using pydantic-settings. Centralising configuration here means the rest of the
codebase never reads os.environ directly, which keeps things testable and makes
it obvious what the application can be configured with.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # `model_config` tells pydantic-settings where to read values from.
    # Environment variables always win over the .env file.
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Application metadata ---
    APP_NAME: str = "Distributed Job Execution Platform"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # --- Database connection ---
    # A single SQLAlchemy URL. The default is a local SQLite file so the app runs
    # with zero external services or setup. To use PostgreSQL instead, set
    # DATABASE_URL in your environment / .env, e.g.:
    #   postgresql+psycopg2://user:pass@localhost:5432/jobdb
    # The code is dialect-agnostic (see models/job.py), so no code changes are
    # needed to switch.
    DATABASE_URL: str = "sqlite:///./jobs.db"

    @property
    def database_url(self) -> str:
        """The configured SQLAlchemy database URL."""
        return self.DATABASE_URL

    # --- Celery / Redis ---
    # Redis is used both as the Celery broker (the queue the web process pushes
    # tasks onto) and as the result backend (where task state/results are stored).
    # Separate logical databases (/0 and /1) keep the two concerns isolated.
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    # --- File storage ---
    # Base directory for uploaded and generated files. Resolved to an absolute
    # path at runtime; both the web process and the worker read/write here, so
    # they must share the same working directory (backend/) or an absolute path.
    STORAGE_DIR: str = "storage"

    # --- CORS ---
    # Origins allowed to call the API from a browser. The React/Vite dev server
    # runs on :5173 by default. Set as a JSON list in the env to override.
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance.

    The lru_cache ensures the .env file is parsed only once per process and the
    same object is reused everywhere it is injected.
    """
    return Settings()


# Convenience module-level singleton for non-DI access (e.g. Alembic env.py).
settings = get_settings()
