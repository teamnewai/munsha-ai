"""THUL-NURAYN v1 — B8 Operations & Monitoring package.

Operational plumbing layered above B7, orthogonal to D3/D4/D5/D6. Observes and
records; never decides risk, never executes, never computes portfolio analytics
(B8_OPERATIONS_ARCHITECTURE). PostgreSQL is the source of truth; Redis is a
non-critical cache.

Exports:
  emit_system_event            — durable append to system_events.
  AlertManager / AlertDispatcher / LogSinkDispatcher — severity-driven alerting.
  DeadLetterQueue              — DLQ over append-only system_events (A1).
  KillSwitchLevelCache         — records/serves kill-switch level (never decides).
  HealthMonitor / HealthReport / ComponentHealth — PostgreSQL+Redis health.
  operational_state            — RUNNING/DEGRADED/PAUSED/SHUTDOWN (observational).
  Scheduler / Worker           — synchronous worker model with failure isolation.
  HealthPoller / DLQMonitor / MissingPartitionDetector (detect-only, A2) /
    RetentionTierer / HeartbeatEmitter — operational workers.
  MetricsCollector / OperationalMetrics — read-only observability.
"""

from .alerting import AlertDispatcher, AlertManager, LogSinkDispatcher
from .dlq import DeadLetterQueue
from .events import emit_system_event
from .health import ComponentHealth, HealthMonitor, HealthReport
from .killswitch import KillSwitchLevelCache
from .metrics import MetricsCollector, OperationalMetrics
from .scheduler import Scheduler, Worker
from .state import operational_state
from .workers import (
    DLQMonitor,
    HealthPoller,
    HeartbeatEmitter,
    MissingPartitionDetector,
    RetentionTierer,
)

__all__ = [
    "emit_system_event",
    "AlertManager",
    "AlertDispatcher",
    "LogSinkDispatcher",
    "DeadLetterQueue",
    "KillSwitchLevelCache",
    "HealthMonitor",
    "HealthReport",
    "ComponentHealth",
    "operational_state",
    "Scheduler",
    "Worker",
    "HealthPoller",
    "DLQMonitor",
    "MissingPartitionDetector",
    "RetentionTierer",
    "HeartbeatEmitter",
    "MetricsCollector",
    "OperationalMetrics",
]
