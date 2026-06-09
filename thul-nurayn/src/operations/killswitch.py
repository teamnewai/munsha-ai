"""THUL-NURAYN v1 — B8 kill-switch level cache.

Serves and records the current kill-switch LEVEL without ever deciding it
(B8_OPERATIONS_ARCHITECTURE §9). The decision to change the level is owned by
D4 / the owner; B8 only:

  * records a level change as an append-only `KillSwitchActivated` system_events
    row (source of truth),
  * caches the current level in Redis for fast reads (non-critical),
  * rebuilds the current level from the latest `KillSwitchActivated` row on
    restart.

The level is treated as DATA (a plain integer in the event `detail` JSONB and
the Redis cache) — B8 does NOT import the risk-local `KillSwitchLevel` enum, so
there is no code dependency on D4 (§12).
"""

from __future__ import annotations

from typing import Optional

from src.enums import SeverityLevel, SystemEventType
from src.logging import get_logger

from .events import emit_system_event

_DEFAULT_CACHE_KEY = "thul:ops:killswitch:level"
_LEVEL_NONE = 0


class KillSwitchLevelCache:
    """Records and serves the kill-switch level; never decides it."""

    def __init__(
        self,
        dal,
        redis_client=None,
        cache_key: str = _DEFAULT_CACHE_KEY,
        logger=None,
    ) -> None:
        self._dal = dal
        self._redis = redis_client
        self._key = cache_key
        self._log = logger or get_logger("thul.killswitch")

    def record(
        self,
        level: int,
        severity: SeverityLevel = SeverityLevel.CRITICAL,
        detail: Optional[dict] = None,
    ):
        """Append a `KillSwitchActivated` row for a level decided elsewhere.

        `level` is supplied by the caller (D4 / owner action). B8 records it.
        """
        payload = {"kind": "kill_switch", "level": int(level)}
        if detail:
            payload.update(detail)
        event = emit_system_event(
            self._dal, SystemEventType.KILL_SWITCH_ACTIVATED, severity, payload
        )
        self._cache_set(int(level))
        return event

    def current_level(self) -> int:
        """Return the current level: Redis cache first, else rebuild from DB."""
        if self._redis is not None and self._redis.available:
            cached = self._redis.get(self._key)
            if cached is not None:
                try:
                    return int(cached)
                except (TypeError, ValueError):
                    pass
        return self.rebuild()

    def rebuild(self) -> int:
        """Recover the current level from the latest `KillSwitchActivated` row."""
        rows = self._dal.system_events.list(
            event_type=SystemEventType.KILL_SWITCH_ACTIVATED
        )
        if not rows:
            self._cache_set(_LEVEL_NONE)
            return _LEVEL_NONE
        latest = max(rows, key=lambda e: e.created_at)
        level = int((latest.detail or {}).get("level", _LEVEL_NONE))
        self._cache_set(level)
        return level

    def _cache_set(self, level: int) -> None:
        if self._redis is None or not self._redis.available:
            return
        try:
            self._redis.set(self._key, str(level))
        except Exception as exc:
            self._log.warning("kill-switch cache update failed: %s", exc)


__all__ = ["KillSwitchLevelCache"]
