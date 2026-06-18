"""Strategy 2 — Core profit exit (F-B) correctness.

The Core engine now has an active profit exit: hard stop + positive break-even +
trailing + regime-flip thesis exit. These unit tests verify each rung and that
Turbo still delegates to the frozen EX-1 engine.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from src.app.exit_decision import ExitEvaluationContext, ExitState
from src.app.strategy2 import Strategy2ExitEngine, proposed_exit_config
from src.enums import Direction, EngineType, PositionStatus
from src.models import Position

D = Decimal


def _pos(engine, direction, entry):
    return Position(id=uuid4(), instrument_id=uuid4(), engine=engine, direction=direction,
                    status=PositionStatus.OPEN, quantity=10,
                    opened_at=datetime(2026, 1, 2, tzinfo=timezone.utc),
                    entry_price=D(entry))


def _eng():
    return Strategy2ExitEngine(proposed_exit_config())


def _fold(eng, pos, marks):
    st = ExitState.initial()
    for m in marks:
        st = eng.advance_state(st, pos, D(m))
    return st


# --- Core: trailing win on up-then-retrace -------------------------------- #
def test_core_trailing_books_a_winner():
    eng = _eng()
    pos = _pos(EngineType.CORE, Direction.LONG, "100")
    st = _fold(eng, pos, ["112", "107"])          # peak 112, retrace 107
    dec = eng.evaluate(ExitEvaluationContext(
        position=pos, mark=D("107"), state=st, regime_is_bull=True))
    assert dec.close and dec.reason == "core_trailing_stop"   # +7% captured


# --- Core: hard stop still protects on straight-down ---------------------- #
def test_core_hard_stop_protects():
    eng = _eng()
    pos = _pos(EngineType.CORE, Direction.LONG, "100")
    st = _fold(eng, pos, ["91"])                  # never armed
    dec = eng.evaluate(ExitEvaluationContext(
        position=pos, mark=D("91"), state=st, regime_is_bull=True))
    assert dec.close and dec.reason == "core_hard_stop"


# --- Core: regime-flip thesis exit ---------------------------------------- #
def test_core_regime_flip_exits():
    eng = _eng()
    pos = _pos(EngineType.CORE, Direction.LONG, "100")
    st = _fold(eng, pos, ["105"])                 # armed, no stop breach
    dec = eng.evaluate(ExitEvaluationContext(
        position=pos, mark=D("105"), state=st, regime_is_bull=False))
    assert dec.close and dec.reason == "core_regime_exit"


# --- Core: winner runs while thesis intact -------------------------------- #
def test_core_holds_while_intact():
    eng = _eng()
    pos = _pos(EngineType.CORE, Direction.LONG, "100")
    st = _fold(eng, pos, ["105"])
    dec = eng.evaluate(ExitEvaluationContext(
        position=pos, mark=D("105"), state=st, regime_is_bull=True))
    assert not dec.close and dec.reason == "core_holding"


# --- Turbo: delegated to frozen EX-1 (unchanged behavior) ----------------- #
def test_turbo_delegates_to_ex1_hard_stop():
    eng = _eng()
    pos = _pos(EngineType.TURBO, Direction.LONG, "100")
    # turbo hard stop 1.5% -> 98.5; mark 98 breaches before arming.
    dec = eng.evaluate(ExitEvaluationContext(position=pos, mark=D("98"),
                                             state=ExitState.initial()))
    assert dec.close and dec.reason == "turbo_hard_stop"
