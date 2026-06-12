"""THUL-NURAYN v1 — B8 metrics & observability.

Read-only operational metrics computed on demand from PostgreSQL (via the
existing DAL `count`) and Redis (B8_OPERATIONS_ARCHITECTURE §7). No metric is
stored in a new table. Metrics are observational only — they never feed back
into risk, selection, execution, or sizing.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from src.enums import OrderStatus, PositionStatus
from src.logging import get_logger


@dataclass(frozen=True)
class OperationalMetrics:
    postgres_healthy: bool
    redis_available: bool
    dlq_depth: int
    open_positions: int
    open_orders: int
    captured_at: datetime


class MetricsCollector:
    """Collects a transient `OperationalMetrics` snapshot from DB + Redis."""

    def __init__(self, dal, health_monitor=None, dlq=None, redis_client=None, logger=None):
        self._dal = dal
        self._health = health_monitor
        self._dlq = dlq
        self._redis = redis_client
        self._log = logger or get_logger("thul.metrics")

    def _open_positions(self) -> int:
        try:
            return self._dal.positions.count(status=PositionStatus.OPEN)
        except Exception as exc:
            self._log.warning("open_positions metric failed: %s", exc)
            return -1

    def _open_orders(self) -> int:
        try:
            new = self._dal.orders.count(status=OrderStatus.NEW)
            sent = self._dal.orders.count(status=OrderStatus.SENT)
            return new + sent
        except Exception as exc:
            self._log.warning("open_orders metric failed: %s", exc)
            return -1

    def collect(self) -> OperationalMetrics:
        pg_ok = True
        if self._health is not None:
            report = self._health.check()
            pg_ok = report.ready
        redis_ok = bool(self._redis.available) if self._redis is not None else False
        depth = self._dlq.depth() if self._dlq is not None else 0
        return OperationalMetrics(
            postgres_healthy=pg_ok,
            redis_available=redis_ok,
            dlq_depth=depth,
            open_positions=self._open_positions(),
            open_orders=self._open_orders(),
            captured_at=datetime.now(timezone.utc),
        )


__all__ = ["MetricsCollector", "OperationalMetrics"]
