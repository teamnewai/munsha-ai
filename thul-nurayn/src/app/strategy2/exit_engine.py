"""Strategy 2 (PROPOSED) — independent exit engine (resolves F-B for Core).

Self-contained. Gives Core an ACTIVE profit-side exit (dormant in Strategy 1 —
F-B) while preserving stop-loss, a positive break-even offset, winners-run, and
PF-first design. Turbo is reused from the frozen EX-1 engine by COMPOSITION (no
modification of shared code).

Core exit ladder (per cycle, Long-only; mirrored defensively):
  1. hard stop (floor)                              -> stop-loss protection
  2. break-even with positive offset (once armed)   -> defended trade books a win
  3. trailing stop (after arming)                   -> winners-run / PF-first
  4. regime-flip thesis exit (Bull-gated)           -> structure-style exit
  5. else HOLD                                      -> winner runs

Inputs are marks + regime (regime supplied by the orchestrator from
frame.market_facts via the read-only MarketRegimeEngine). No new data source, no
schema change, no shared-domain modification.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from decimal import Decimal
from typing import Optional

from src.enums import Direction, EngineType
from src.models import Position

from ..exit_decision import (
    CLOSE,
    ExitConfig,
    ExitDecision,
    ExitDecisionEngine,
    ExitEvaluationContext,
    ExitState,
)

_ZERO = Decimal("0")
_ONE = Decimal("1")


@dataclass(frozen=True)
class Strategy2ExitConfig:
    """Independent exit configuration (Core gets full break-even + trailing)."""

    core_hard_stop_pct: Decimal
    core_be_trigger_pct: Decimal
    core_be_offset_pct: Decimal
    core_trailing_pct: Decimal
    turbo_hard_stop_pct: Decimal
    turbo_be_trigger_pct: Decimal
    turbo_be_offset_pct: Decimal
    turbo_trailing_pct: Decimal
    turbo_session_close_cutoff_min: int

    def invalid_reason(self) -> Optional[str]:
        pcts = (
            ("core_hard_stop_pct", self.core_hard_stop_pct),
            ("core_be_trigger_pct", self.core_be_trigger_pct),
            ("core_be_offset_pct", self.core_be_offset_pct),
            ("core_trailing_pct", self.core_trailing_pct),
            ("turbo_hard_stop_pct", self.turbo_hard_stop_pct),
            ("turbo_be_trigger_pct", self.turbo_be_trigger_pct),
            ("turbo_be_offset_pct", self.turbo_be_offset_pct),
            ("turbo_trailing_pct", self.turbo_trailing_pct),
        )
        for name, val in pcts:
            if not isinstance(val, Decimal) or not val.is_finite():
                return f"{name} non-finite"
            if val <= _ZERO or val >= _ONE:
                return f"{name} out of (0,1): {val}"
        if not isinstance(self.turbo_session_close_cutoff_min, int):
            return "turbo_session_close_cutoff_min not int"
        if self.turbo_session_close_cutoff_min < 0:
            return "turbo_session_close_cutoff_min negative"
        return None

    def to_turbo_exit_config(self) -> ExitConfig:
        """Map Turbo params to a shared EX-1 ExitConfig (for composition)."""
        return ExitConfig(
            core_hard_stop_pct=self.core_hard_stop_pct,  # unused on the Turbo path
            turbo_hard_stop_pct=self.turbo_hard_stop_pct,
            turbo_breakeven_trigger_pct=self.turbo_be_trigger_pct,
            turbo_breakeven_offset_pct=self.turbo_be_offset_pct,
            turbo_trailing_pct=self.turbo_trailing_pct,
            turbo_session_close_cutoff_min=self.turbo_session_close_cutoff_min,
        )


class Strategy2ExitEngine:
    """Core profit-exit ladder (new) + Turbo delegated to EX-1 (reuse)."""

    def __init__(self, config: Strategy2ExitConfig) -> None:
        self._config = config
        self._turbo = ExitDecisionEngine(config.to_turbo_exit_config())

    @property
    def config(self) -> Strategy2ExitConfig:
        return self._config

    def advance_state(
        self, state: ExitState, position: Position, mark: Optional[Decimal]
    ) -> ExitState:
        entry = position.entry_price
        if mark is None or not mark.is_finite() or mark <= _ZERO:
            return state
        if entry is None or not entry.is_finite() or entry <= _ZERO:
            return state
        is_long = position.direction == Direction.LONG
        prev = state.favorable_extreme
        if prev is None:
            new_extreme = mark
        elif is_long:
            new_extreme = max(prev, mark)
        else:
            new_extreme = min(prev, mark)
        trig = (self._config.core_be_trigger_pct
                if position.engine == EngineType.CORE
                else self._config.turbo_be_trigger_pct)
        armed = state.breakeven_armed or self._armed(entry, new_extreme, is_long, trig)
        return replace(state, favorable_extreme=new_extreme, breakeven_armed=armed)

    @staticmethod
    def _armed(entry: Decimal, extreme: Decimal, is_long: bool, trig: Decimal) -> bool:
        return extreme >= entry * (_ONE + trig) if is_long \
            else extreme <= entry * (_ONE - trig)

    def evaluate(self, ctx: ExitEvaluationContext) -> ExitDecision:
        bad = self._config.invalid_reason()
        if bad is not None:
            return ExitDecision.hold(f"invalid_config:{bad}")
        if ctx.position.engine == EngineType.TURBO:
            return self._turbo.evaluate(ctx)  # reuse frozen EX-1 by composition

        mark = ctx.mark
        if mark is None or not mark.is_finite() or mark <= _ZERO:
            return ExitDecision.hold("missing_mark")
        entry = ctx.position.entry_price
        if entry is None or not entry.is_finite() or entry <= _ZERO:
            return ExitDecision.hold("missing_entry")
        return self._evaluate_core(ctx, mark, entry)

    def _evaluate_core(
        self, ctx: ExitEvaluationContext, mark: Decimal, entry: Decimal
    ) -> ExitDecision:
        cfg = self._config
        is_long = ctx.position.direction == Direction.LONG

        prev = ctx.state.favorable_extreme
        if prev is None:
            extreme = mark
        elif is_long:
            extreme = max(prev, mark)
        else:
            extreme = min(prev, mark)
        armed = ctx.state.breakeven_armed or self._armed(
            entry, extreme, is_long, cfg.core_be_trigger_pct)

        hard = entry * (_ONE - cfg.core_hard_stop_pct) if is_long \
            else entry * (_ONE + cfg.core_hard_stop_pct)

        if not armed:
            effective, reason = hard, "core_hard_stop"
        else:
            be = entry * (_ONE + cfg.core_be_offset_pct) if is_long \
                else entry * (_ONE - cfg.core_be_offset_pct)
            trail = extreme * (_ONE - cfg.core_trailing_pct) if is_long \
                else extreme * (_ONE + cfg.core_trailing_pct)
            effective = max(hard, be, trail) if is_long else min(hard, be, trail)
            if effective == trail:
                reason = "core_trailing_stop"
            elif effective == be:
                reason = "core_breakeven_stop"
            else:
                reason = "core_hard_stop"

        breached = mark <= effective if is_long else mark >= effective
        if breached:
            return ExitDecision.to_close(reason)

        if ctx.regime_is_bull is not None:
            if is_long and ctx.regime_is_bull is False:
                return ExitDecision(action=CLOSE, reason="core_regime_exit")
            if (not is_long) and ctx.regime_is_bull is True:
                return ExitDecision(action=CLOSE, reason="core_regime_exit")

        return ExitDecision.hold("core_holding")


__all__ = ["Strategy2ExitConfig", "Strategy2ExitEngine"]
