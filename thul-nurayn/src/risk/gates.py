"""THUL-NURAYN v1 — D4 risk gates (Master §14, §19).

Eight independent, pure, deterministic gates. Each returns a GateResult.
A gate raising on bad input is caught by the engine and converted to a
Fail-Safe rejection (D4 §3/§5).
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from . import constants as C
from .state import GateResult, KillSwitchLevel, RiskState


class Gate(ABC):
    name: str

    @abstractmethod
    def evaluate(self, state: RiskState) -> GateResult: ...


class KillSwitchGate(Gate):
    """Reject new trades when the kill switch is at L2 or above (Master §19)."""

    name = "KillSwitch"

    def evaluate(self, state: RiskState) -> GateResult:
        engaged = int(state.kill_switch_level) >= C.KILL_SWITCH_BLOCK_LEVEL
        return GateResult(
            self.name, not engaged,
            f"kill_switch={KillSwitchLevel(state.kill_switch_level).name}",
        )


class MaxOpenPositionsGate(Gate):
    name = "MaxOpenPositions"

    def evaluate(self, state: RiskState) -> GateResult:
        ok = state.open_positions < C.MAX_OPEN_POSITIONS
        return GateResult(self.name, ok,
                          f"open={state.open_positions} (<{C.MAX_OPEN_POSITIONS})")


class MaxTradesPerDayGate(Gate):
    name = "MaxTradesPerDay"

    def evaluate(self, state: RiskState) -> GateResult:
        ok = state.trades_today < C.MAX_TRADES_PER_DAY
        return GateResult(self.name, ok,
                          f"trades_today={state.trades_today} (<{C.MAX_TRADES_PER_DAY})")


class DailyDrawdownGate(Gate):
    name = "DailyDrawdown"

    def evaluate(self, state: RiskState) -> GateResult:
        ok = state.daily_drawdown > C.DAILY_DRAWDOWN_LIMIT
        return GateResult(self.name, ok,
                          f"daily={state.daily_drawdown} (>{C.DAILY_DRAWDOWN_LIMIT})")


class WeeklyDrawdownGate(Gate):
    name = "WeeklyDrawdown"

    def evaluate(self, state: RiskState) -> GateResult:
        ok = state.weekly_drawdown > C.WEEKLY_DRAWDOWN_LIMIT
        return GateResult(self.name, ok,
                          f"weekly={state.weekly_drawdown} (>{C.WEEKLY_DRAWDOWN_LIMIT})")


class MonthlyDrawdownGate(Gate):
    """Monthly drawdown has no % in the spec ('Pause Trading'); this gate
    rejects only when an operational monthly pause is active (D4 §8)."""

    name = "MonthlyDrawdown"

    def evaluate(self, state: RiskState) -> GateResult:
        ok = not state.monthly_pause_active
        return GateResult(self.name, ok, f"monthly_pause={state.monthly_pause_active}")


class ConsecutiveLossGate(Gate):
    name = "ConsecutiveLoss"

    def evaluate(self, state: RiskState) -> GateResult:
        ok = state.consecutive_losses < C.CONSECUTIVE_LOSS_LIMIT
        return GateResult(
            self.name, ok,
            f"consecutive={state.consecutive_losses} (<{C.CONSECUTIVE_LOSS_LIMIT})",
        )


class SectorExposureGate(Gate):
    name = "SectorExposure"

    def evaluate(self, state: RiskState) -> GateResult:
        total = (
            state.candidate_sector_current_exposure
            + state.candidate_sector_added_exposure
        )
        ok = total <= C.SECTOR_EXPOSURE_MAX
        return GateResult(self.name, ok,
                          f"sector_total={total} (<={C.SECTOR_EXPOSURE_MAX})")


# Evaluation order — Kill Switch FIRST (D4 §3).
ALL_GATES: list[Gate] = [
    KillSwitchGate(),
    MaxOpenPositionsGate(),
    MaxTradesPerDayGate(),
    DailyDrawdownGate(),
    WeeklyDrawdownGate(),
    MonthlyDrawdownGate(),
    ConsecutiveLossGate(),
    SectorExposureGate(),
]


__all__ = [
    "Gate",
    "KillSwitchGate",
    "MaxOpenPositionsGate",
    "MaxTradesPerDayGate",
    "DailyDrawdownGate",
    "WeeklyDrawdownGate",
    "MonthlyDrawdownGate",
    "ConsecutiveLossGate",
    "SectorExposureGate",
    "ALL_GATES",
]
