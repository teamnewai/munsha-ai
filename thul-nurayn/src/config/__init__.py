"""THUL-NURAYN v1 — B8 operational configuration.

Env-based operational settings for the operations & monitoring layer.
No secrets live here: PostgreSQL/Redis DSNs are read by B7 (`DATABASE_URL`,
`REDIS_URL`); this module holds only non-secret operational tunables and
defaults (B8_OPERATIONS_ARCHITECTURE §2, §6).
"""

from __future__ import annotations

import os
from dataclasses import dataclass


def _int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    return int(raw) if raw not in (None, "") else default


def _float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    return float(raw) if raw not in (None, "") else default


@dataclass(frozen=True)
class OperationsConfig:
    """Non-secret operational tunables (env-overridable)."""

    # DLQ alert thresholds (unresolved depth)
    dlq_depth_warning: int = 1
    dlq_depth_critical: int = 10
    # Worker cadences (seconds)
    health_poll_interval_sec: float = 30.0
    dlq_monitor_interval_sec: float = 60.0
    partition_check_interval_sec: float = 86_400.0
    retention_tier_interval_sec: float = 86_400.0
    # Retention tiering windows (months) — D1 §7 Hot -> Warm -> Cold
    retention_hot_months: int = 3
    retention_warm_months: int = 12
    # Redis cache keys (non-secret)
    kill_switch_cache_key: str = "thul:ops:killswitch:level"
    dlq_index_key: str = "thul:ops:dlq:unresolved"

    @classmethod
    def from_env(cls) -> "OperationsConfig":
        """Build config from environment variables, falling back to defaults."""
        return cls(
            dlq_depth_warning=_int("OPS_DLQ_DEPTH_WARNING", cls.dlq_depth_warning),
            dlq_depth_critical=_int("OPS_DLQ_DEPTH_CRITICAL", cls.dlq_depth_critical),
            health_poll_interval_sec=_float(
                "OPS_HEALTH_POLL_INTERVAL_SEC", cls.health_poll_interval_sec
            ),
            dlq_monitor_interval_sec=_float(
                "OPS_DLQ_MONITOR_INTERVAL_SEC", cls.dlq_monitor_interval_sec
            ),
            partition_check_interval_sec=_float(
                "OPS_PARTITION_CHECK_INTERVAL_SEC", cls.partition_check_interval_sec
            ),
            retention_tier_interval_sec=_float(
                "OPS_RETENTION_TIER_INTERVAL_SEC", cls.retention_tier_interval_sec
            ),
            retention_hot_months=_int(
                "OPS_RETENTION_HOT_MONTHS", cls.retention_hot_months
            ),
            retention_warm_months=_int(
                "OPS_RETENTION_WARM_MONTHS", cls.retention_warm_months
            ),
            kill_switch_cache_key=os.environ.get(
                "OPS_KILL_SWITCH_CACHE_KEY", cls.kill_switch_cache_key
            ),
            dlq_index_key=os.environ.get("OPS_DLQ_INDEX_KEY", cls.dlq_index_key),
        )


__all__ = ["OperationsConfig"]
