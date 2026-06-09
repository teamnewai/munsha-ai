"""THUL-NURAYN v1 — Logging Layer.

Structured, JSON-first logging built on the Python standard library (no
external dependency). Severity is aligned with the :class:`SeverityLevel`
enum so logs, ``system_events``, and ``audit_logs`` share one vocabulary.

The ``import logging`` below resolves to the *standard library* module
(absolute import), not this package, because this package is
``thul_nurayn.logging``.
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any, Mapping, Optional

from thul_nurayn.domain.enums import SeverityLevel

_SEVERITY_TO_LEVELNO = {
    SeverityLevel.DEBUG: logging.DEBUG,
    SeverityLevel.INFO: logging.INFO,
    SeverityLevel.WARNING: logging.WARNING,
    SeverityLevel.ERROR: logging.ERROR,
    SeverityLevel.CRITICAL: logging.CRITICAL,
}

_RESERVED = set(
    logging.makeLogRecord({}).__dict__.keys()
) | {"message", "asctime"}


class JsonFormatter(logging.Formatter):
    """Render log records as single-line JSON objects."""

    def __init__(self, service_name: str = "thul-nurayn") -> None:
        super().__init__()
        self.service_name = service_name

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.fromtimestamp(
                record.created, tz=timezone.utc
            ).isoformat(),
            "level": record.levelname,
            "service": self.service_name,
            "logger": record.name,
            "message": record.getMessage(),
        }
        # Merge any structured 'extra' fields that aren't reserved.
        for key, value in record.__dict__.items():
            if key not in _RESERVED and not key.startswith("_"):
                payload[key] = _safe(value)
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str, separators=(",", ":"))


def _safe(value: Any) -> Any:
    try:
        json.dumps(value)
        return value
    except (TypeError, ValueError):
        return str(value)


class BoundLogger:
    """A thin logger that carries persistent structured context."""

    def __init__(self, logger: logging.Logger, context: Optional[Mapping[str, Any]] = None):
        self._logger = logger
        self._context = dict(context or {})

    def bind(self, **context: Any) -> "BoundLogger":
        merged = {**self._context, **context}
        return BoundLogger(self._logger, merged)

    def log(self, severity: SeverityLevel, message: str, **fields: Any) -> None:
        levelno = _SEVERITY_TO_LEVELNO[SeverityLevel.coerce(severity)]
        self._logger.log(levelno, message, extra={**self._context, **fields})

    def debug(self, message: str, **fields: Any) -> None:
        self.log(SeverityLevel.DEBUG, message, **fields)

    def info(self, message: str, **fields: Any) -> None:
        self.log(SeverityLevel.INFO, message, **fields)

    def warning(self, message: str, **fields: Any) -> None:
        self.log(SeverityLevel.WARNING, message, **fields)

    def error(self, message: str, **fields: Any) -> None:
        self.log(SeverityLevel.ERROR, message, **fields)

    def critical(self, message: str, **fields: Any) -> None:
        self.log(SeverityLevel.CRITICAL, message, **fields)


_CONFIGURED = False


def configure_logging(
    level: str = "INFO",
    json_output: bool = True,
    service_name: str = "thul-nurayn",
    stream: Any = None,
) -> None:
    """Configure the root logger once. Idempotent."""
    global _CONFIGURED
    root = logging.getLogger()
    root.setLevel(level.upper())
    # Remove our previously-installed handlers to keep this idempotent.
    for h in list(root.handlers):
        if getattr(h, "_thul_nurayn", False):
            root.removeHandler(h)
    handler = logging.StreamHandler(stream or sys.stdout)
    handler._thul_nurayn = True  # type: ignore[attr-defined]
    if json_output:
        handler.setFormatter(JsonFormatter(service_name))
    else:
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
        )
    root.addHandler(handler)
    _CONFIGURED = True


def get_logger(name: str = "thul_nurayn", **context: Any) -> BoundLogger:
    """Return a :class:`BoundLogger` for ``name`` with optional bound context."""
    if not _CONFIGURED:
        configure_logging()
    return BoundLogger(logging.getLogger(name), context)


__all__ = [
    "JsonFormatter",
    "BoundLogger",
    "configure_logging",
    "get_logger",
]
