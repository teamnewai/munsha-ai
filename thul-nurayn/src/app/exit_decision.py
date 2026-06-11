"""THUL-NURAYN v1 — EX-1 Exit Decision Engine (pure CLOSE/HOLD decision).

The Exit Decision Engine decides, per open position per cycle, whether to CLOSE
or HOLD — implementing the owner-ratified exit philosophy. It DECIDES ONLY; it
never executes a close (EX-2), never touches the execution target (EX-3). It is
pure, deterministic, stateless, and config-driven — the same discipline as
P-SIZE (`sizing.py`).

Ratified philosophy (owner-final):
  * Core  — structure/trend exit + hard-stop-only · winners run · no fixed target.
            CLOSE when: hard stop hit  OR  (Trend-Stage break AND Regime flip)  [C-1].
            Basis: percentage (C-2). Long-only (Bull-gated); evaluated EOD (C-4).
  * Turbo — hard stop + break-even + trailing + mandatory session-close flatten.
            CLOSE when: effective stop (hard→break-even→trailing) breached
            OR within the session-close cutoff. Basis: percentage (T-1/T-4).
  * Shared — full close only (no partial) · Long/Short symmetry (X-1) ·
             gap-through-stop fills at the actual mark (the *engine* signals CLOSE;
             EX-2 fills at the supplied mark) · exits permitted at kill-switch
             L1–L3 (the orchestrator gates that; L4 halts all).

Data scope (C-3 = marks-computable Core path): for an open position the engine
consumes per-cycle PRICE MARKS plus whatever facts the caller can supply. Under
the marks-computable path the per-instrument `trend_stage2` fact is NOT
recomputed for open positions, so it is supplied as ``None``; per the fail-safe
rule a missing/unknown structural fact never forces a close (the Trend-Stage
component stays unconfirmed and the position holds on the structure path — the
hard stop still protects downside). The engine is forward-compatible: when a
future, separately-gated data path supplies `trend_stage2`, the Trend-Stage
component activates with no code change.

Fail-safe (Master §13 discipline): the engine NEVER raises on bad input — a
missing/invalid mark, missing entry price, or invalid configuration yields HOLD
with an explicit reason. It fabricates no price and forces no close on missing
data.

Values V-1…V-6 are CONFIGURATION ONLY (`ExitConfig`); the engine hardcodes no
strategy value. `ExitConfig.provisional()` supplies the owner-reviewed
*provisional* Moderate brackets (clearly NOT the final Master-Spec values).
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from decimal import Decimal
from typing import Optional

from src.enums import Direction, EngineType
from src.models import Position

# -- decision actions (transient strings; not a new D1 enum) ----------------- #
CLOSE = "CLOSE"
HOLD = "HOLD"

_ZERO = Decimal("0")
_ONE = Decimal("1")


# --------------------------------------------------------------------------- #
# Configuration (V-1 … V-6) — injected; no strategy value hardcoded
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class ExitConfig:
    """Owner exit values as configuration parameters.

    Percentages are fractions of entry price (e.g. Decimal("0.08") = 8%).
    The session cutoff is whole minutes before the session close.
    """

    core_hard_stop_pct: Decimal            # V-1
    turbo_hard_stop_pct: Decimal           # V-2
    turbo_breakeven_trigger_pct: Decimal   # V-3
    turbo_breakeven_offset_pct: Decimal    # V-4
    turbo_trailing_pct: Decimal            # V-5
    turbo_session_close_cutoff_min: int    # V-6

    @classmethod
    def provisional(cls) -> "ExitConfig":
        """PROVISIONAL placeholder config — owner-reviewed *Moderate* brackets
        from EXIT_VALUE_DECISION_MATRIX. These are NOT the final Master-Spec
        values; they exist only so the exit leg can run. Final values are
        supplied (and gate the campaign) later, with no code change.
        """
        return cls(
            core_hard_stop_pct=Decimal("0.08"),            # V-1 ~8%
            turbo_hard_stop_pct=Decimal("0.02"),           # V-2 ~2%
            turbo_breakeven_trigger_pct=Decimal("0.015"),  # V-3 ~1.5%
            turbo_breakeven_offset_pct=Decimal("0.0025"),  # V-4 ~0.25%
            turbo_trailing_pct=Decimal("0.02"),            # V-5 ~2%
            turbo_session_close_cutoff_min=10,             # V-6 ~10 min
        )

    def invalid_reason(self) -> Optional[str]:
        """Return an explicit reason if any value is unusable, else None.

        Percentages must be finite and in (0, 1); the cutoff must be a
        non-negative int. (Fail-safe: callers convert this to a HOLD.)
        """
        pcts = (
            ("core_hard_stop_pct", self.core_hard_stop_pct),
            ("turbo_hard_stop_pct", self.turbo_hard_stop_pct),
            ("turbo_breakeven_trigger_pct", self.turbo_breakeven_trigger_pct),
            ("turbo_breakeven_offset_pct", self.turbo_breakeven_offset_pct),
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


# --------------------------------------------------------------------------- #
# Per-position exit-state — re-derivable from marks (NO persistence, no schema)
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class ExitState:
    """Re-derivable trailing/break-even state for one open position.

    `favorable_extreme` is the most-favorable mark observed since entry
    (the high-water for a long, the low-water for a short). `breakeven_armed`
    latches True once the break-even trigger is reached and never reverts.
    Re-derived by folding the mark history forward (deterministic); never stored.
    """

    favorable_extreme: Optional[Decimal] = None
    breakeven_armed: bool = False

    @classmethod
    def initial(cls) -> "ExitState":
        return cls(favorable_extreme=None, breakeven_armed=False)


# --------------------------------------------------------------------------- #
# Evaluation context — everything the pure engine consumes for one decision
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class ExitEvaluationContext:
    """Inputs for one CLOSE/HOLD decision (transient; supplied by the caller).

    Core uses `regime_is_bull` (per-cycle computable) and `trend_stage2`
    (``None`` under the marks-computable path — Trend-Stage stays unconfirmed).
    Turbo uses `market_open` and `minutes_to_close` for the session flatten.
    """

    position: Position
    mark: Optional[Decimal]
    state: ExitState = ExitState()
    regime_is_bull: Optional[bool] = None      # Core
    trend_stage2: Optional[bool] = None        # Core (None under C-3)
    market_open: bool = True                    # Turbo
    minutes_to_close: Optional[int] = None      # Turbo (session flatten)


@dataclass(frozen=True)
class ExitDecision:
    """Outcome of one evaluation (transient; not persisted)."""

    action: str    # CLOSE or HOLD
    reason: str    # explicit, always set

    @property
    def close(self) -> bool:
        return self.action == CLOSE

    @classmethod
    def hold(cls, reason: str) -> "ExitDecision":
        return cls(action=HOLD, reason=reason)

    @classmethod
    def to_close(cls, reason: str) -> "ExitDecision":
        return cls(action=CLOSE, reason=reason)


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def _positive_finite(value: Optional[Decimal]) -> bool:
    return isinstance(value, Decimal) and value.is_finite() and value > _ZERO


# --------------------------------------------------------------------------- #
# Engine
# --------------------------------------------------------------------------- #
class ExitDecisionEngine:
    """Pure CLOSE/HOLD decision engine. Construct with an `ExitConfig`.

    Deterministic and stateless across calls: the per-position exit-state is
    threaded by the caller via `advance_state` (re-derivable, never stored).
    Never raises — invalid inputs/config yield HOLD with an explicit reason.
    """

    def __init__(self, config: ExitConfig) -> None:
        self._config = config

    @property
    def config(self) -> ExitConfig:
        return self._config

    # -- state advance (pure; caller threads across cycles) ---------------- #
    def advance_state(
        self, state: ExitState, position: Position, mark: Optional[Decimal]
    ) -> ExitState:
        """Fold a new mark into the exit-state (favorable extreme + BE latch).

        Returns the state unchanged on an unusable mark or entry. Pure.
        """
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
        armed = state.breakeven_armed or self._be_trigger_reached(
            entry, new_extreme, is_long
        )
        return replace(state, favorable_extreme=new_extreme, breakeven_armed=armed)

    def _be_trigger_reached(
        self, entry: Decimal, extreme: Decimal, is_long: bool
    ) -> bool:
        trig = self._config.turbo_breakeven_trigger_pct
        if is_long:
            return extreme >= entry * (_ONE + trig)
        return extreme <= entry * (_ONE - trig)

    # -- evaluate ----------------------------------------------------------- #
    def evaluate(self, ctx: ExitEvaluationContext) -> ExitDecision:
        cfg_bad = self._config.invalid_reason()
        if cfg_bad is not None:
            return ExitDecision.hold(f"invalid_config:{cfg_bad}")

        mark = ctx.mark
        if mark is None or not mark.is_finite() or mark <= _ZERO:
            return ExitDecision.hold("missing_mark")
        entry = ctx.position.entry_price
        if entry is None or not entry.is_finite() or entry <= _ZERO:
            return ExitDecision.hold("missing_entry")

        engine = ctx.position.engine
        if engine == EngineType.CORE:
            return self._evaluate_core(ctx, mark, entry)
        if engine == EngineType.TURBO:
            return self._evaluate_turbo(ctx, mark, entry)
        return ExitDecision.hold("unknown_engine")

    # -- Core: hard stop OR (trend-stage break AND regime flip) ------------ #
    def _evaluate_core(
        self, ctx: ExitEvaluationContext, mark: Decimal, entry: Decimal
    ) -> ExitDecision:
        pct = self._config.core_hard_stop_pct
        is_long = ctx.position.direction == Direction.LONG  # Core long-only; mirror defensively

        if is_long:
            if mark <= entry * (_ONE - pct):
                return ExitDecision.to_close("core_hard_stop")
        else:
            if mark >= entry * (_ONE + pct):
                return ExitDecision.to_close("core_hard_stop")

        # Structure/trend exit: BOTH components must confirm (C-1, AND).
        # Unknown (None) inputs never confirm a break (fail-safe; winner runs).
        trend_broken = ctx.trend_stage2 is False
        regime_flipped = ctx.regime_is_bull is False
        if trend_broken and regime_flipped:
            return ExitDecision.to_close("core_structure_break")

        return ExitDecision.hold("core_thesis_intact")

    # -- Turbo: effective stop (hard→BE→trail) breach OR session flatten --- #
    def _evaluate_turbo(
        self, ctx: ExitEvaluationContext, mark: Decimal, entry: Decimal
    ) -> ExitDecision:
        cfg = self._config
        is_long = ctx.position.direction == Direction.LONG

        # Working extreme includes the current mark (idempotent with advance_state).
        prev = ctx.state.favorable_extreme
        if prev is None:
            extreme = mark
        elif is_long:
            extreme = max(prev, mark)
        else:
            extreme = min(prev, mark)
        armed = ctx.state.breakeven_armed or self._be_trigger_reached(
            entry, extreme, is_long
        )

        hard = entry * (_ONE - cfg.turbo_hard_stop_pct) if is_long \
            else entry * (_ONE + cfg.turbo_hard_stop_pct)

        if not armed:
            effective, reason = hard, "turbo_hard_stop"
        else:
            be = entry * (_ONE + cfg.turbo_breakeven_offset_pct) if is_long \
                else entry * (_ONE - cfg.turbo_breakeven_offset_pct)
            trail = extreme * (_ONE - cfg.turbo_trailing_pct) if is_long \
                else extreme * (_ONE + cfg.turbo_trailing_pct)
            if is_long:
                effective = max(hard, be, trail)
            else:
                effective = min(hard, be, trail)
            # Attribute the reason to the binding level (trail > break-even > hard).
            if effective == trail:
                reason = "turbo_trailing_stop"
            elif effective == be:
                reason = "turbo_breakeven_stop"
            else:
                reason = "turbo_hard_stop"

        breached = mark <= effective if is_long else mark >= effective
        if breached:
            return ExitDecision.to_close(reason)

        # Mandatory session-close flatten (no overnight Turbo carry).
        if self._session_closing(ctx):
            return ExitDecision.to_close("turbo_session_close")

        return ExitDecision.hold("turbo_protected")

    def _session_closing(self, ctx: ExitEvaluationContext) -> bool:
        if not ctx.market_open:
            return True  # already closed → must be flat
        mtc = ctx.minutes_to_close
        if mtc is None:
            return False  # unknown time-to-close → fail-safe, do not force
        return mtc <= self._config.turbo_session_close_cutoff_min


__all__ = [
    "CLOSE",
    "HOLD",
    "ExitConfig",
    "ExitState",
    "ExitEvaluationContext",
    "ExitDecision",
    "ExitDecisionEngine",
]
