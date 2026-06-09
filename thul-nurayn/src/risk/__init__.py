"""THUL-NURAYN v1 — D4 Risk Gate.

Ten components (D4_RISK_GATE_REPORT §2): eight independent gates + Fail-Safe +
the Risk Decision Engine. Pure, deterministic, accept/reject ONLY. Risk ⟂
Execution: no order, no sizing, no portfolio analytics, no broker. 100% offline.
Consumes a passed-in RiskState; reuses D1's RiskDecision enum. D1/D2/D3 unchanged.
"""

from __future__ import annotations

from .constants import (
    CONSECUTIVE_LOSS_LIMIT,
    DAILY_DRAWDOWN_LIMIT,
    KILL_SWITCH_BLOCK_LEVEL,
    MAX_OPEN_POSITIONS,
    MAX_TRADES_PER_DAY,
    SECTOR_EXPOSURE_MAX,
    WEEKLY_DRAWDOWN_LIMIT,
)
from .engine import RiskDecisionEngine
from .gates import (
    ALL_GATES,
    ConsecutiveLossGate,
    DailyDrawdownGate,
    Gate,
    KillSwitchGate,
    MaxOpenPositionsGate,
    MaxTradesPerDayGate,
    MonthlyDrawdownGate,
    SectorExposureGate,
    WeeklyDrawdownGate,
)
from .state import GateResult, KillSwitchLevel, RiskDecisionResult, RiskState

__all__ = [
    "RiskDecisionEngine",
    "RiskState",
    "RiskDecisionResult",
    "GateResult",
    "KillSwitchLevel",
    "Gate",
    "ALL_GATES",
    "KillSwitchGate",
    "MaxOpenPositionsGate",
    "MaxTradesPerDayGate",
    "DailyDrawdownGate",
    "WeeklyDrawdownGate",
    "MonthlyDrawdownGate",
    "ConsecutiveLossGate",
    "SectorExposureGate",
    "MAX_OPEN_POSITIONS",
    "MAX_TRADES_PER_DAY",
    "DAILY_DRAWDOWN_LIMIT",
    "WEEKLY_DRAWDOWN_LIMIT",
    "CONSECUTIVE_LOSS_LIMIT",
    "SECTOR_EXPOSURE_MAX",
    "KILL_SWITCH_BLOCK_LEVEL",
]
