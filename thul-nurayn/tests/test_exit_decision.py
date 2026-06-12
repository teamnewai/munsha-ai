"""EX-1 — Exit Decision Engine tests (pure CLOSE/HOLD logic).

Covers: fail-safe holds, config validation, Core (hard stop + structure AND),
Turbo (hard → break-even → trailing → session flatten), state derivation, and
Long/Short symmetry. No execution, orchestration, or persistence is exercised.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

import pytest

from src.app.exit_decision import (
    CLOSE,
    HOLD,
    ExitConfig,
    ExitDecisionEngine,
    ExitEvaluationContext,
    ExitState,
)
from src.enums import Direction, EngineType, PositionStatus
from src.models import Position

D = Decimal


def _pos(engine, direction, entry):
    return Position(
        id=uuid4(),
        instrument_id=uuid4(),
        engine=engine,
        direction=direction,
        status=PositionStatus.OPEN,
        quantity=10,
        opened_at=datetime(2026, 1, 2, tzinfo=timezone.utc),
        entry_price=D(entry) if entry is not None else None,
    )


def _eng():
    return ExitDecisionEngine(ExitConfig.provisional())


# --------------------------------------------------------------------------- #
# Config
# --------------------------------------------------------------------------- #
class TestConfig:
    def test_provisional_is_valid(self):
        assert ExitConfig.provisional().invalid_reason() is None

    def test_non_finite_pct_rejected(self):
        c = ExitConfig.provisional()
        bad = ExitConfig(
            core_hard_stop_pct=D("NaN"),
            turbo_hard_stop_pct=c.turbo_hard_stop_pct,
            turbo_breakeven_trigger_pct=c.turbo_breakeven_trigger_pct,
            turbo_breakeven_offset_pct=c.turbo_breakeven_offset_pct,
            turbo_trailing_pct=c.turbo_trailing_pct,
            turbo_session_close_cutoff_min=c.turbo_session_close_cutoff_min,
        )
        assert bad.invalid_reason() is not None

    def test_out_of_range_pct_rejected(self):
        c = ExitConfig.provisional()
        bad = ExitConfig(
            core_hard_stop_pct=D("1.5"),  # >= 1
            turbo_hard_stop_pct=c.turbo_hard_stop_pct,
            turbo_breakeven_trigger_pct=c.turbo_breakeven_trigger_pct,
            turbo_breakeven_offset_pct=c.turbo_breakeven_offset_pct,
            turbo_trailing_pct=c.turbo_trailing_pct,
            turbo_session_close_cutoff_min=c.turbo_session_close_cutoff_min,
        )
        assert bad.invalid_reason() is not None

    def test_negative_cutoff_rejected(self):
        c = ExitConfig.provisional()
        bad = ExitConfig(
            core_hard_stop_pct=c.core_hard_stop_pct,
            turbo_hard_stop_pct=c.turbo_hard_stop_pct,
            turbo_breakeven_trigger_pct=c.turbo_breakeven_trigger_pct,
            turbo_breakeven_offset_pct=c.turbo_breakeven_offset_pct,
            turbo_trailing_pct=c.turbo_trailing_pct,
            turbo_session_close_cutoff_min=-1,
        )
        assert bad.invalid_reason() is not None

    def test_invalid_config_yields_hold(self):
        bad = ExitConfig(
            core_hard_stop_pct=D("0"),  # <= 0
            turbo_hard_stop_pct=D("0.02"),
            turbo_breakeven_trigger_pct=D("0.015"),
            turbo_breakeven_offset_pct=D("0.0025"),
            turbo_trailing_pct=D("0.02"),
            turbo_session_close_cutoff_min=10,
        )
        eng = ExitDecisionEngine(bad)
        pos = _pos(EngineType.CORE, Direction.LONG, "100")
        dec = eng.evaluate(ExitEvaluationContext(position=pos, mark=D("100")))
        assert dec.action == HOLD and dec.reason.startswith("invalid_config:")


# --------------------------------------------------------------------------- #
# Fail-safe holds
# --------------------------------------------------------------------------- #
class TestFailSafe:
    def test_missing_mark_holds(self):
        pos = _pos(EngineType.CORE, Direction.LONG, "100")
        dec = _eng().evaluate(ExitEvaluationContext(position=pos, mark=None))
        assert dec.action == HOLD and dec.reason == "missing_mark"

    def test_non_finite_mark_holds(self):
        pos = _pos(EngineType.TURBO, Direction.LONG, "100")
        dec = _eng().evaluate(ExitEvaluationContext(position=pos, mark=D("Infinity")))
        assert dec.action == HOLD and dec.reason == "missing_mark"

    def test_missing_entry_holds(self):
        pos = _pos(EngineType.CORE, Direction.LONG, None)
        dec = _eng().evaluate(ExitEvaluationContext(position=pos, mark=D("100")))
        assert dec.action == HOLD and dec.reason == "missing_entry"

    def test_engine_never_raises_on_garbage_mark(self):
        pos = _pos(EngineType.TURBO, Direction.SHORT, "100")
        # NaN must not raise — must hold.
        dec = _eng().evaluate(ExitEvaluationContext(position=pos, mark=D("NaN")))
        assert dec.action == HOLD


# --------------------------------------------------------------------------- #
# Core — hard stop + (trend-stage break AND regime flip)
# --------------------------------------------------------------------------- #
class TestCore:
    def test_hard_stop_closes(self):
        pos = _pos(EngineType.CORE, Direction.LONG, "100")  # hard at 92 (8%)
        dec = _eng().evaluate(ExitEvaluationContext(position=pos, mark=D("91")))
        assert dec.action == CLOSE and dec.reason == "core_hard_stop"

    def test_above_hard_stop_holds_when_thesis_intact(self):
        pos = _pos(EngineType.CORE, Direction.LONG, "100")
        dec = _eng().evaluate(
            ExitEvaluationContext(
                position=pos, mark=D("93"), regime_is_bull=True, trend_stage2=True
            )
        )
        assert dec.action == HOLD and dec.reason == "core_thesis_intact"

    def test_structure_break_requires_both(self):
        pos = _pos(EngineType.CORE, Direction.LONG, "100")
        # Both broken → CLOSE
        dec = _eng().evaluate(
            ExitEvaluationContext(
                position=pos, mark=D("99"), regime_is_bull=False, trend_stage2=False
            )
        )
        assert dec.action == CLOSE and dec.reason == "core_structure_break"

    def test_only_trend_break_holds(self):
        pos = _pos(EngineType.CORE, Direction.LONG, "100")
        dec = _eng().evaluate(
            ExitEvaluationContext(
                position=pos, mark=D("99"), regime_is_bull=True, trend_stage2=False
            )
        )
        assert dec.action == HOLD

    def test_only_regime_flip_holds(self):
        pos = _pos(EngineType.CORE, Direction.LONG, "100")
        dec = _eng().evaluate(
            ExitEvaluationContext(
                position=pos, mark=D("99"), regime_is_bull=False, trend_stage2=True
            )
        )
        assert dec.action == HOLD

    def test_unknown_trend_stage_never_forces_close(self):
        # C-3 marks-computable path: trend_stage2 is None → structure stays unconfirmed.
        pos = _pos(EngineType.CORE, Direction.LONG, "100")
        dec = _eng().evaluate(
            ExitEvaluationContext(
                position=pos, mark=D("99"), regime_is_bull=False, trend_stage2=None
            )
        )
        assert dec.action == HOLD and dec.reason == "core_thesis_intact"


# --------------------------------------------------------------------------- #
# Turbo — hard → break-even → trailing → session flatten
# --------------------------------------------------------------------------- #
class TestTurboLong:
    def test_hard_stop_before_arming(self):
        pos = _pos(EngineType.TURBO, Direction.LONG, "100")  # hard at 98 (2%)
        dec = _eng().evaluate(ExitEvaluationContext(position=pos, mark=D("97")))
        assert dec.action == CLOSE and dec.reason == "turbo_hard_stop"

    def test_breakeven_stop_after_arming(self):
        eng = _eng()
        pos = _pos(EngineType.TURBO, Direction.LONG, "100")
        st = eng.advance_state(ExitState.initial(), pos, D("102"))  # arms (>=101.5)
        assert st.breakeven_armed
        # be level 100.25; trail 102*0.98=99.96 → effective = be
        dec = eng.evaluate(
            ExitEvaluationContext(position=pos, mark=D("100.20"), state=st)
        )
        assert dec.action == CLOSE and dec.reason == "turbo_breakeven_stop"

    def test_holds_above_breakeven(self):
        eng = _eng()
        pos = _pos(EngineType.TURBO, Direction.LONG, "100")
        st = eng.advance_state(ExitState.initial(), pos, D("102"))
        dec = eng.evaluate(
            ExitEvaluationContext(position=pos, mark=D("100.30"), state=st)
        )
        assert dec.action == HOLD and dec.reason == "turbo_protected"

    def test_trailing_stop_binds_on_large_winner(self):
        eng = _eng()
        pos = _pos(EngineType.TURBO, Direction.LONG, "100")
        st = eng.advance_state(ExitState.initial(), pos, D("110"))  # trail 107.8 > be
        dec = eng.evaluate(
            ExitEvaluationContext(position=pos, mark=D("107"), state=st)
        )
        assert dec.action == CLOSE and dec.reason == "turbo_trailing_stop"

    def test_trailing_holds_above_trail(self):
        eng = _eng()
        pos = _pos(EngineType.TURBO, Direction.LONG, "100")
        st = eng.advance_state(ExitState.initial(), pos, D("110"))
        dec = eng.evaluate(
            ExitEvaluationContext(position=pos, mark=D("108"), state=st)
        )
        assert dec.action == HOLD

    def test_session_flatten_within_cutoff(self):
        pos = _pos(EngineType.TURBO, Direction.LONG, "100")
        dec = _eng().evaluate(
            ExitEvaluationContext(
                position=pos, mark=D("100"), market_open=True, minutes_to_close=5
            )
        )
        assert dec.action == CLOSE and dec.reason == "turbo_session_close"

    def test_no_session_flatten_outside_cutoff(self):
        pos = _pos(EngineType.TURBO, Direction.LONG, "100")
        dec = _eng().evaluate(
            ExitEvaluationContext(
                position=pos, mark=D("100"), market_open=True, minutes_to_close=20
            )
        )
        assert dec.action == HOLD

    def test_market_closed_forces_flatten(self):
        pos = _pos(EngineType.TURBO, Direction.LONG, "100")
        dec = _eng().evaluate(
            ExitEvaluationContext(position=pos, mark=D("100"), market_open=False)
        )
        assert dec.action == CLOSE and dec.reason == "turbo_session_close"

    def test_unknown_time_to_close_does_not_flatten(self):
        pos = _pos(EngineType.TURBO, Direction.LONG, "100")
        dec = _eng().evaluate(
            ExitEvaluationContext(
                position=pos, mark=D("100"), market_open=True, minutes_to_close=None
            )
        )
        assert dec.action == HOLD


class TestTurboShort:
    def test_hard_stop_before_arming(self):
        pos = _pos(EngineType.TURBO, Direction.SHORT, "100")  # hard at 102
        dec = _eng().evaluate(ExitEvaluationContext(position=pos, mark=D("103")))
        assert dec.action == CLOSE and dec.reason == "turbo_hard_stop"

    def test_trailing_stop_binds(self):
        eng = _eng()
        pos = _pos(EngineType.TURBO, Direction.SHORT, "100")
        st = eng.advance_state(ExitState.initial(), pos, D("90"))  # trail 91.8
        assert st.breakeven_armed
        dec = eng.evaluate(
            ExitEvaluationContext(position=pos, mark=D("92"), state=st)
        )
        assert dec.action == CLOSE and dec.reason == "turbo_trailing_stop"

    def test_holds_below_trail(self):
        eng = _eng()
        pos = _pos(EngineType.TURBO, Direction.SHORT, "100")
        st = eng.advance_state(ExitState.initial(), pos, D("90"))
        dec = eng.evaluate(
            ExitEvaluationContext(position=pos, mark=D("91"), state=st)
        )
        assert dec.action == HOLD


# --------------------------------------------------------------------------- #
# State derivation
# --------------------------------------------------------------------------- #
class TestStateAdvance:
    def test_long_extreme_tracks_high_water(self):
        eng = _eng()
        pos = _pos(EngineType.TURBO, Direction.LONG, "100")
        st = ExitState.initial()
        for m in ("101", "103", "102"):
            st = eng.advance_state(st, pos, D(m))
        assert st.favorable_extreme == D("103")
        assert st.breakeven_armed  # 103 >= 101.5

    def test_short_extreme_tracks_low_water(self):
        eng = _eng()
        pos = _pos(EngineType.TURBO, Direction.SHORT, "100")
        st = ExitState.initial()
        for m in ("99", "97", "98"):
            st = eng.advance_state(st, pos, D(m))
        assert st.favorable_extreme == D("97")
        assert st.breakeven_armed  # 97 <= 98.5

    def test_breakeven_latch_is_monotonic(self):
        eng = _eng()
        pos = _pos(EngineType.TURBO, Direction.LONG, "100")
        st = eng.advance_state(ExitState.initial(), pos, D("102"))  # armed
        st = eng.advance_state(st, pos, D("100"))  # pull back — stays armed
        assert st.breakeven_armed

    def test_unusable_mark_is_noop(self):
        eng = _eng()
        pos = _pos(EngineType.TURBO, Direction.LONG, "100")
        st = eng.advance_state(ExitState.initial(), pos, D("105"))
        same = eng.advance_state(st, pos, None)
        assert same == st


# --------------------------------------------------------------------------- #
# Symmetry & determinism
# --------------------------------------------------------------------------- #
class TestSymmetryDeterminism:
    def test_long_short_hard_stop_symmetry(self):
        eng = _eng()
        long_pos = _pos(EngineType.TURBO, Direction.LONG, "100")
        short_pos = _pos(EngineType.TURBO, Direction.SHORT, "100")
        # Each 3% adverse from entry → both breach the 2% hard stop.
        long_dec = eng.evaluate(ExitEvaluationContext(position=long_pos, mark=D("97")))
        short_dec = eng.evaluate(ExitEvaluationContext(position=short_pos, mark=D("103")))
        assert long_dec.action == short_dec.action == CLOSE
        assert long_dec.reason == short_dec.reason == "turbo_hard_stop"

    def test_deterministic(self):
        eng = _eng()
        pos = _pos(EngineType.TURBO, Direction.LONG, "100")
        st = eng.advance_state(ExitState.initial(), pos, D("110"))
        ctx = ExitEvaluationContext(position=pos, mark=D("107"), state=st)
        first = eng.evaluate(ctx)
        for _ in range(5):
            assert eng.evaluate(ctx) == first


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(pytest.main([__file__, "-q"]))
