"""THUL-NURAYN v1 — B8 operational workers.

Concrete workers (B8_OPERATIONS_ARCHITECTURE §6). All are operations-only and
read-only with respect to domain state; none import D3/D4/D5/D6 logic.

Owner ratification A2: partitions are DETECT-AND-ALERT ONLY — B8 does NOT
auto-provision partitions. `MissingPartitionDetector` alerts on a missing
upcoming partition; `RetentionTierer` is read-only classification/reporting and
never deletes or moves data.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Callable, Optional

from src.enums import SeverityLevel, SystemEventType
from src.logging import get_logger

from .events import emit_system_event
from .scheduler import Worker

# The 6 partitioned tables (frozen D1 schema).
PARTITIONED_TABLES = (
    "signals", "orders", "audit_logs",
    "system_events", "market_snapshots", "risk_snapshots",
)


def _next_month_yyyymm(now: Optional[datetime] = None) -> str:
    now = now or datetime.now(timezone.utc)
    year, month = now.year, now.month
    if month == 12:
        year, month = year + 1, 1
    else:
        month += 1
    return f"{year:04d}{month:02d}"


class HealthPoller(Worker):
    """Runs the health probes; the HealthMonitor emits transition events."""

    name = "health_poller"

    def __init__(self, health_monitor, interval: float = 30.0) -> None:
        self.interval = interval
        self._health = health_monitor
        self.last_report = None

    def run_once(self) -> None:
        self.last_report = self._health.check()


class DLQMonitor(Worker):
    """Computes unresolved DLQ depth and alerts per configured thresholds."""

    name = "dlq_monitor"

    def __init__(self, dlq, alert_manager, config, interval: float = 60.0) -> None:
        self.interval = interval
        self._dlq = dlq
        self._alerts = alert_manager
        self._cfg = config

    def run_once(self) -> None:
        depth = self._dlq.depth()
        if depth >= self._cfg.dlq_depth_critical:
            self._alerts.alert(
                SystemEventType.WORKER_FAILURE, SeverityLevel.CRITICAL,
                {"kind": "dlq_depth", "depth": depth, "threshold": "critical"},
            )
        elif depth >= self._cfg.dlq_depth_warning:
            self._alerts.alert(
                SystemEventType.WORKER_FAILURE, SeverityLevel.WARNING,
                {"kind": "dlq_depth", "depth": depth, "threshold": "warning"},
            )


class MissingPartitionDetector(Worker):
    """Detect-and-alert only (A2): alerts if next month's partition is missing.

    `partition_exists(table, yyyymm) -> bool` is injected (production wiring
    backs it with a pool query against pg_catalog). B8 never creates partitions.
    """

    name = "partition_detector"

    def __init__(
        self,
        alert_manager,
        partition_exists: Callable[[str, str], bool],
        interval: float = 86_400.0,
        clock: Optional[Callable[[], datetime]] = None,
    ) -> None:
        self.interval = interval
        self._alerts = alert_manager
        self._exists = partition_exists
        self._clock = clock or (lambda: datetime.now(timezone.utc))

    def run_once(self) -> None:
        yyyymm = _next_month_yyyymm(self._clock())
        missing = [t for t in PARTITIONED_TABLES if not self._exists(t, yyyymm)]
        if missing:
            self._alerts.alert(
                SystemEventType.WORKER_FAILURE, SeverityLevel.CRITICAL,
                {"kind": "missing_partition", "period": yyyymm, "tables": missing},
            )


class RetentionTierer(Worker):
    """Read-only Hot->Warm->Cold classification + reporting (D1 §7).

    Never deletes or moves data; audit & system data are archived, never
    deleted. `list_partitions() -> list[dict(table, yyyymm)]` is injected.
    """

    name = "retention_tierer"

    def __init__(
        self,
        dal,
        config,
        list_partitions: Callable[[], list],
        interval: float = 86_400.0,
        clock: Optional[Callable[[], datetime]] = None,
    ) -> None:
        self.interval = interval
        self._dal = dal
        self._cfg = config
        self._list = list_partitions
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        self.last_classification: dict = {}

    def _age_months(self, yyyymm: str, now: datetime) -> int:
        year, month = int(yyyymm[:4]), int(yyyymm[4:6])
        return (now.year - year) * 12 + (now.month - month)

    def _tier(self, age_months: int) -> str:
        if age_months <= self._cfg.retention_hot_months:
            return "Hot"
        if age_months <= self._cfg.retention_warm_months:
            return "Warm"
        return "Cold"

    def run_once(self) -> None:
        now = self._clock()
        classification: dict[str, str] = {}
        for part in self._list():
            table, yyyymm = part["table"], part["yyyymm"]
            classification[f"{table}_p{yyyymm}"] = self._tier(
                self._age_months(yyyymm, now)
            )
        self.last_classification = classification
        # Report-only; never destructive.
        emit_system_event(
            self._dal, SystemEventType.SERVICE_STARTED, SeverityLevel.WARNING,
            {"kind": "retention_report", "tiers": classification},
        )


class HeartbeatEmitter:
    """Lifecycle service events (start/stop). Not a periodic worker."""

    def __init__(self, dal) -> None:
        self._dal = dal

    def on_start(self):
        return emit_system_event(
            self._dal, SystemEventType.SERVICE_STARTED, SeverityLevel.WARNING,
            {"kind": "lifecycle", "event": "started"},
        )

    def on_stop(self):
        return emit_system_event(
            self._dal, SystemEventType.SERVICE_STOPPED, SeverityLevel.WARNING,
            {"kind": "lifecycle", "event": "stopped"},
        )


__all__ = [
    "HealthPoller", "DLQMonitor", "MissingPartitionDetector",
    "RetentionTierer", "HeartbeatEmitter", "PARTITIONED_TABLES",
]
