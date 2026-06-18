"""THUL-NURAYN v1 — B7 Redis ephemeral-state client.

Non-fatal failure model (B7_ARCHITECTURE_SUMMARY §4):
  * Redis is NEVER a source of truth — PostgreSQL is.
  * If Redis is unreachable at startup, a WARNING is logged and the client
    enters degraded mode; the application continues normally.
  * Every operation in degraded mode returns None (get/set/delete) or False
    (ping) and logs a WARNING.  No exception is surfaced to callers.

Config env vars:
  REDIS_URL         — Redis DSN (default: redis://localhost:6379/0)
  REDIS_TIMEOUT_SEC — socket timeout in seconds (default: 5)

Exposed operations: ping · get · set · delete.
No richer Redis usage in B7; that is B8/D8 scope.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Optional

import redis as _redis

log = logging.getLogger(__name__)

_DEFAULT_URL = "redis://localhost:6379/0"
_DEFAULT_TIMEOUT = 5


class RedisClient:
    """Synchronous redis-py wrapper with a non-fatal degraded-mode fallback."""

    def __init__(
        self,
        url: str | None = None,
        timeout: int | None = None,
    ) -> None:
        url = url or os.environ.get("REDIS_URL", _DEFAULT_URL)
        timeout = timeout or int(os.environ.get("REDIS_TIMEOUT_SEC", _DEFAULT_TIMEOUT))

        try:
            self._client: Optional[_redis.Redis] = _redis.Redis.from_url(
                url,
                socket_timeout=timeout,
                socket_connect_timeout=timeout,
                decode_responses=True,
            )
            self._client.ping()
            self._available = True
            log.info("Redis connected: %s", url)
        except Exception as exc:
            log.warning(
                "Redis unavailable at %s — running in degraded mode: %s", url, exc
            )
            self._client = None
            self._available = False

    @property
    def available(self) -> bool:
        """True if Redis is reachable."""
        return self._available

    def ping(self) -> bool:
        """Return True if Redis responds; False in degraded mode or on failure."""
        if self._client is None:
            return False
        try:
            return bool(self._client.ping())
        except Exception as exc:
            log.warning("Redis ping failed: %s", exc)
            return False

    def get(self, key: str) -> Optional[str]:
        """Return the string value for key, or None on miss / degraded mode."""
        if self._client is None:
            return None
        try:
            return self._client.get(key)
        except Exception as exc:
            log.warning("Redis get(%s) failed: %s", key, exc)
            return None

    def set(self, key: str, value: Any, ex: Optional[int] = None) -> Optional[bool]:
        """Set key to value (with optional TTL in seconds).

        Returns True on success, None in degraded mode or on failure.
        """
        if self._client is None:
            return None
        try:
            return self._client.set(key, value, ex=ex)
        except Exception as exc:
            log.warning("Redis set(%s) failed: %s", key, exc)
            return None

    def delete(self, key: str) -> Optional[int]:
        """Delete key.  Returns number of keys deleted, or None on failure."""
        if self._client is None:
            return None
        try:
            return self._client.delete(key)
        except Exception as exc:
            log.warning("Redis delete(%s) failed: %s", key, exc)
            return None


__all__ = ["RedisClient"]
