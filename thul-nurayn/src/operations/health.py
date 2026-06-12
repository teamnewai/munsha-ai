"""THUL-NURAYN v1 — B8 health monitoring.

Probes PostgreSQL (mandatory) and Redis (optional) using the B7 primitives and
produces a transient `HealthReport` read model (B8_OPERATIONS_ARCHITECTURE §3):

  * PostgreSQL unreachable  -> NOT ready.
  * Redis unreachable       -> DEGRADED (Redis is a non-critical cache).
  * Probes are read-only and side-effect free EXCEPT for emitting a single
    `system_events` row on a component state TRANSITION (e.g. Redis
    available -> unavailable), never one per poll.

`HealthReport` is a value object — not a persisted entity, not a new table.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from src.enums import SeverityLevel, SystemEventType
from src.logging import get_logger

# Health status constants (transient; not an enum, not persisted)
HEALTHY = "healthy"
DEGRADED = "degraded"
UNAVAILABLE = "unavailable"


@dataclass(frozen=True)
class ComponentHealth:
    name: str
    healthy: bool
    detail: Optional[str] = None


@dataclass(frozen=True)
class HealthReport:
    ready: bool          # PostgreSQL reachable
    status: str          # HEALTHY | DEGRADED | UNAVAILABLE
    components: tuple     # tuple[ComponentHealth, ...]
    captured_at: datetime

    def component(self, name: str) -> Optional[ComponentHealth]:
        for c in self.components:
            if c.name == name:
                return c
        return None


class HealthMonitor:
    """Runs PostgreSQL + Redis probes; emits transition events; reports health."""

    def __init__(self, pool=None, redis_client=None, alert_manager=None, logger=None):
        self._pool = pool
        self._redis = redis_client
        self._alerts = alert_manager
        self._log = logger or get_logger("thul.health")
        self._prev: dict[str, bool] = {}

    # -- probes ------------------------------------------------------------ #
    def _check_postgres(self) -> ComponentHealth:
        if self._pool is None:
            return ComponentHealth("postgres", False, "no pool configured")
        try:
            with self._pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                    cur.fetchone()
            return ComponentHealth("postgres", True)
        except Exception as exc:
            return ComponentHealth("postgres", False, str(exc))

    def _check_redis(self) -> ComponentHealth:
        if self._redis is None:
            return ComponentHealth("redis", False, "no client configured")
        try:
            ok = bool(self._redis.ping())
            return ComponentHealth("redis", ok, None if ok else "ping failed")
        except Exception as exc:
            return ComponentHealth("redis", False, str(exc))

    # -- report ------------------------------------------------------------ #
    def check(self) -> HealthReport:
        pg = self._check_postgres()
        rd = self._check_redis()

        ready = pg.healthy  # PostgreSQL is mandatory
        if not pg.healthy:
            status = UNAVAILABLE
        elif not rd.healthy:
            status = DEGRADED  # Redis is a non-critical cache
        else:
            status = HEALTHY

        self._emit_transitions(pg, rd)

        return HealthReport(
            ready=ready,
            status=status,
            components=(pg, rd),
            captured_at=datetime.now(timezone.utc),
        )

    def _emit_transitions(self, pg: ComponentHealth, rd: ComponentHealth) -> None:
        """Emit one system_events row only when a component's health changes."""
        self._maybe_emit(
            "postgres", pg.healthy, SystemEventType.POSTGRES_EVENT,
            SeverityLevel.EMERGENCY, pg.detail,
        )
        self._maybe_emit(
            "redis", rd.healthy, SystemEventType.REDIS_EVENT,
            SeverityLevel.WARNING, rd.detail,
        )

    def _maybe_emit(self, name, healthy, event_type, down_severity, detail) -> None:
        prev = self._prev.get(name)
        if prev is not None and prev == healthy:
            return  # no transition
        self._prev[name] = healthy
        if prev is None:
            return  # first observation establishes baseline; no alert
        if self._alerts is None:
            return
        severity = down_severity if not healthy else SeverityLevel.WARNING
        state = "up" if healthy else "down"
        self._alerts.alert(
            event_type,
            severity,
            {"kind": "health_transition", "component": name, "state": state,
             "detail": detail},
        )


__all__ = [
    "HealthMonitor", "HealthReport", "ComponentHealth",
    "HEALTHY", "DEGRADED", "UNAVAILABLE",
]
