"""THUL-NURAYN v1 — Configuration Layer.

Environment-driven, dependency-free settings. Values are read from the process
environment (optionally seeded from a ``.env`` file) and grouped into
typed, frozen dataclasses. No secrets are hard-coded; every field has a safe
local-development default except those that must be supplied per deployment.

Usage::

    from thul_nurayn.config import get_settings
    settings = get_settings()
    settings.database.dsn
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Optional


def _load_dotenv(path: str | os.PathLike[str]) -> dict[str, str]:
    """Minimal ``.env`` parser (no external dependency)."""
    values: dict[str, str] = {}
    p = Path(path)
    if not p.exists():
        return values
    for raw in p.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        val = val.strip().strip('"').strip("'")
        values[key.strip()] = val
    return values


def _env(key: str, default: Optional[str], overlay: dict[str, str]) -> Optional[str]:
    return os.environ.get(key, overlay.get(key, default))


def _bool(value: Optional[str], default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _int(value: Optional[str], default: int) -> int:
    try:
        return int(value) if value is not None else default
    except ValueError:
        return default


@dataclass(frozen=True)
class DatabaseSettings:
    host: str = "localhost"
    port: int = 5432
    name: str = "thul_nurayn"
    user: str = "thul_nurayn"
    password: str = ""
    pool_min: int = 1
    pool_max: int = 10
    statement_timeout_ms: int = 30_000

    @property
    def dsn(self) -> str:
        auth = self.user if not self.password else f"{self.user}:{self.password}"
        return f"postgresql://{auth}@{self.host}:{self.port}/{self.name}"


@dataclass(frozen=True)
class RedisSettings:
    host: str = "localhost"
    port: int = 6379
    db: int = 0
    password: Optional[str] = None
    namespace: str = "tn"
    socket_timeout_s: int = 5

    @property
    def url(self) -> str:
        auth = f":{self.password}@" if self.password else ""
        return f"redis://{auth}{self.host}:{self.port}/{self.db}"


@dataclass(frozen=True)
class LoggingSettings:
    level: str = "INFO"
    json: bool = True
    service_name: str = "thul-nurayn"


@dataclass(frozen=True)
class AppSettings:
    environment: str = "development"  # development | staging | production
    debug: bool = False
    version: str = "1.0.0"


@dataclass(frozen=True)
class Settings:
    app: AppSettings = field(default_factory=AppSettings)
    database: DatabaseSettings = field(default_factory=DatabaseSettings)
    redis: RedisSettings = field(default_factory=RedisSettings)
    logging: LoggingSettings = field(default_factory=LoggingSettings)

    @property
    def is_production(self) -> bool:
        return self.app.environment == "production"


def load_settings(dotenv_path: str | os.PathLike[str] = ".env") -> Settings:
    """Build a :class:`Settings` from environment + optional ``.env`` overlay."""
    overlay = _load_dotenv(dotenv_path)

    app = AppSettings(
        environment=_env("TN_ENV", "development", overlay) or "development",
        debug=_bool(_env("TN_DEBUG", None, overlay), False),
        version=_env("TN_VERSION", "1.0.0", overlay) or "1.0.0",
    )
    database = DatabaseSettings(
        host=_env("TN_DB_HOST", "localhost", overlay) or "localhost",
        port=_int(_env("TN_DB_PORT", None, overlay), 5432),
        name=_env("TN_DB_NAME", "thul_nurayn", overlay) or "thul_nurayn",
        user=_env("TN_DB_USER", "thul_nurayn", overlay) or "thul_nurayn",
        password=_env("TN_DB_PASSWORD", "", overlay) or "",
        pool_min=_int(_env("TN_DB_POOL_MIN", None, overlay), 1),
        pool_max=_int(_env("TN_DB_POOL_MAX", None, overlay), 10),
        statement_timeout_ms=_int(_env("TN_DB_STMT_TIMEOUT_MS", None, overlay), 30_000),
    )
    redis = RedisSettings(
        host=_env("TN_REDIS_HOST", "localhost", overlay) or "localhost",
        port=_int(_env("TN_REDIS_PORT", None, overlay), 6379),
        db=_int(_env("TN_REDIS_DB", None, overlay), 0),
        password=_env("TN_REDIS_PASSWORD", None, overlay),
        namespace=_env("TN_REDIS_NAMESPACE", "tn", overlay) or "tn",
        socket_timeout_s=_int(_env("TN_REDIS_TIMEOUT_S", None, overlay), 5),
    )
    logging_ = LoggingSettings(
        level=_env("TN_LOG_LEVEL", "INFO", overlay) or "INFO",
        json=_bool(_env("TN_LOG_JSON", None, overlay), True),
        service_name=_env("TN_LOG_SERVICE", "thul-nurayn", overlay) or "thul-nurayn",
    )
    return Settings(app=app, database=database, redis=redis, logging=logging_)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Process-wide cached settings."""
    return load_settings()


__all__ = [
    "Settings",
    "AppSettings",
    "DatabaseSettings",
    "RedisSettings",
    "LoggingSettings",
    "load_settings",
    "get_settings",
]
