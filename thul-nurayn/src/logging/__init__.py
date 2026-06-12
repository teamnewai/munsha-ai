"""THUL-NURAYN v1 — B8 structured logging.

Fills the B1 `src/logging/` placeholder (mirroring how B7 filled `src/redis/`).
Provides a severity-tagged structured logger with secret redaction at the
logging boundary (B8_OPERATIONS_ARCHITECTURE §7, §11).

No secrets are ever emitted: connection strings with embedded credentials and
common secret key=value pairs are redacted before the record is written.
"""

from __future__ import annotations

import logging
import re
from typing import Optional

# Patterns redacted at the logging boundary (no secrets in logs — §11).
_DSN_CRED = re.compile(r"(?P<scheme>[a-zA-Z][a-zA-Z0-9+.\-]*://)[^@/\s]+@")
_KV_SECRET = re.compile(
    r"(?i)\b(password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key)\b"
    r"\s*[=:]\s*[^\s,;]+"
)

_REDACTED = "[REDACTED]"
_CONFIGURED = False


def redact(text: str) -> str:
    """Redact credentials in DSNs and common secret key=value pairs."""
    if not text:
        return text
    text = _DSN_CRED.sub(lambda m: f"{m.group('scheme')}{_REDACTED}@", text)
    text = _KV_SECRET.sub(
        lambda m: f"{m.group(0).split('=')[0].split(':')[0].rstrip()}={_REDACTED}",
        text,
    )
    return text


class RedactionFilter(logging.Filter):
    """Logging filter that redacts secrets from the formatted message."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            message = record.getMessage()
        except Exception:
            return True
        redacted = redact(message)
        if redacted != message:
            record.msg = redacted
            record.args = ()
        return True


def configure_logging(level: int = logging.INFO) -> None:
    """Configure root logging once with a structured formatter + redaction filter."""
    global _CONFIGURED
    if _CONFIGURED:
        return
    handler = logging.StreamHandler()
    handler.setFormatter(
        logging.Formatter(
            "%(asctime)s level=%(levelname)s logger=%(name)s msg=%(message)s"
        )
    )
    handler.addFilter(RedactionFilter())
    root = logging.getLogger()
    root.addHandler(handler)
    root.setLevel(level)
    _CONFIGURED = True


def get_logger(name: Optional[str] = None) -> logging.Logger:
    """Return a logger; ensures redaction is configured."""
    configure_logging()
    logger = logging.getLogger(name if name else "thul")
    # Guarantee redaction even if the app configured its own handlers.
    if not any(isinstance(f, RedactionFilter) for f in logger.filters):
        logger.addFilter(RedactionFilter())
    return logger


__all__ = ["configure_logging", "get_logger", "redact", "RedactionFilter"]
