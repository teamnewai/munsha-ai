"""THUL-NURAYN v1 — B8 operational state model.

Computes a transient operational status from health (§3) + the RECORDED
kill-switch level (§9). Observational only: B8 reports the state; it never
pauses trades, changes risk state, or decides the kill-switch level. The actual
pausing/blocking of trades is owned by D4 (risk) and D5 (execution)
(B8_OPERATIONS_ARCHITECTURE §10).

Not a persisted entity, not a new table.
"""

from __future__ import annotations

from .health import HealthReport

# Operational states (transient strings; not an enum, not persisted)
RUNNING = "RUNNING"
DEGRADED = "DEGRADED"
PAUSED = "PAUSED"
SHUTDOWN = "SHUTDOWN"

# Kill-switch level thresholds (data values, mirroring the L1–L4 ladder).
_L4_EMERGENCY_SHUTDOWN = 4
_L2_PAUSE_NEW_TRADES = 2
_L3_PAUSE_EXECUTION = 3


def operational_state(health: HealthReport, kill_switch_level: int) -> str:
    """Derive RUNNING / DEGRADED / PAUSED / SHUTDOWN (observational).

    Precedence: not-ready or L4 -> SHUTDOWN; L2/L3 -> PAUSED; degraded health
    -> DEGRADED; otherwise RUNNING.
    """
    level = int(kill_switch_level)
    if not health.ready or level >= _L4_EMERGENCY_SHUTDOWN:
        return SHUTDOWN
    if level in (_L2_PAUSE_NEW_TRADES, _L3_PAUSE_EXECUTION):
        return PAUSED
    if health.status != "healthy":
        return DEGRADED
    return RUNNING


__all__ = ["operational_state", "RUNNING", "DEGRADED", "PAUSED", "SHUTDOWN"]
