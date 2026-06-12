"""THUL-NURAYN v1 — D4 Risk Gate inputs & outputs.

RiskState is PASSED IN (computed elsewhere — portfolio analytics live in D6).
D4 does not compute equity/PnL/positions here (D4_RISK_GATE_REPORT §4).

KillSwitchLevel (L1–L4) is transcribed from Master §19 and kept local to the
risk module (D1's enum set is unchanged).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from enum import IntEnum
from typing import Optional


class KillSwitchLevel(IntEnum):
    """Master §19 kill-switch levels (ordered)."""

    NONE = 0
    L1 = 1  # Pause Scanner
    L2 = 2  # Pause New Trades
    L3 = 3  # Pause Execution Engine
    L4 = 4  # Emergency Shutdown


@dataclass(frozen=True)
class RiskState:
    """All inputs a risk decision needs — passed in, not computed here."""

    kill_switch_level: KillSwitchLevel = KillSwitchLevel.NONE
    open_positions: int = 0
    trades_today: int = 0
    daily_drawdown: Decimal = Decimal("0")
    weekly_drawdown: Decimal = Decimal("0")
    monthly_pause_active: bool = False
    consecutive_losses: int = 0
    candidate_sector_current_exposure: Decimal = Decimal("0")
    candidate_sector_added_exposure: Decimal = Decimal("0")


@dataclass(frozen=True)
class GateResult:
    """Per-gate outcome — full transparency for audit (D4 §4)."""

    name: str
    passed: bool
    reason: str = ""


@dataclass(frozen=True)
class RiskDecisionResult:
    """Aggregate decision (D4 §3/§4)."""

    decision: "object"  # RiskDecision enum (from src.enums) — typed in engine
    gates: tuple = field(default_factory=tuple)
    rejected_by: Optional[str] = None

    @property
    def accepted(self) -> bool:
        return self.rejected_by is None


__all__ = ["KillSwitchLevel", "RiskState", "GateResult", "RiskDecisionResult"]
