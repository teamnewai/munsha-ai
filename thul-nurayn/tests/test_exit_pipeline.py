"""EX-2/EX-3/EX-4/EX-5 — exit execution + orchestration + end-to-end.

Verifies the wired exit leg: D5-reusing close execution (EX-2), the execution
target close capability (EX-3), the P-ORCH exit stage (EX-4), and the end-to-end
result that D14 now sees a real closed trade (EX-5). No broker, no network.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from src.data_access.dal import DataAccessLayer
from src.enums import (
    Direction,
    EngineType,
    Market,
    OrderStatus,
    PositionStatus,
)
from src.models import Instrument, Position, Sector
from src.app.bootstrap import build_application
from src.app.exit_execution import close_position
from src.app.marketdata import ReplayMarketDataProvider
from src.app.orchestrator import COMPLETED, HALTED, PAUSED_SCANNER, PipelineOrchestrator
from src.app.sizing import CapitalSettings, SizingPolicy
from src.app.targets import PaperTarget, SignalsOnlyTarget
from src.app.targets.paper import PaperBrokerSyncContract
from src.app.validation.metrics import compute_validation_metrics
from src.execution.engine import ExecutionEngine

_UTC = timezone.utc
_CAP = Decimal("100000")


def _now() -> datetime:
    return datetime(2026, 6, 10, 14, 30, tzinfo=_UTC)


def _seed_instrument(dal, symbol="AAPL") -> Instrument:
    sec = Sector(id=uuid4(), name=f"S-{uuid4().hex[:6]}", created_at=_now())
    dal.sectors.add(sec)
    inst = Instrument(id=uuid4(), symbol=symbol, market=Market.NASDAQ,
                      sector_id=sec.id, created_at=_now())
    dal.instruments.add(inst)
    return inst


def _engine(dal):
    return ExecutionEngine(dal, broker_sync=PaperBrokerSyncContract())


def _open_position(dal, inst, *, engine=EngineType.CORE, direction=Direction.LONG,
                   entry="150", qty=66):
    pos = Position(
        id=uuid4(), instrument_id=inst.id, engine=engine, direction=direction,
        status=PositionStatus.OPEN, quantity=qty, opened_at=_now(),
        entry_price=Decimal(entry),
    )
    dal.positions.add(pos)
    return pos


# --------------------------------------------------------------------------- #
# EX-2 — close execution (reuses D5)
# --------------------------------------------------------------------------- #
class TestCloseExecution:
    def test_close_marks_position_closed_and_fills_order(self):
        dal = DataAccessLayer()
        inst = _seed_instrument(dal)
        eng = _engine(dal)
        pos = _open_position(dal, inst)

        out = close_position(eng, pos, Decimal("160"), uuid4(), at=_now())

        assert out.closed
        assert out.position.status == PositionStatus.CLOSED
        assert out.position.exit_price == Decimal("160")
        assert out.position.closed_at == _now()
        # a closing order was created and FILLED, tagged paper:
        assert dal.orders.count(status=OrderStatus.FILLED) == 1
        assert out.order.broker_ref.startswith("paper:")
        # the persisted row reflects the close
        assert dal.positions.count(status=PositionStatus.CLOSED) == 1

    def test_close_rejects_non_open(self):
        dal = DataAccessLayer()
        inst = _seed_instrument(dal)
        eng = _engine(dal)
        pos = _open_position(dal, inst)
        out1 = close_position(eng, pos, Decimal("160"), uuid4(), at=_now())
        out2 = close_position(eng, out1.position, Decimal("160"), uuid4(), at=_now())
        assert out1.closed and not out2.closed and out2.reason == "not_open"

    def test_close_rejects_invalid_mark(self):
        dal = DataAccessLayer()
        inst = _seed_instrument(dal)
        eng = _engine(dal)
        pos = _open_position(dal, inst)
        out = close_position(eng, pos, None, uuid4(), at=_now())
        assert not out.closed and out.reason == "invalid_mark"

    def test_short_close_reuses_same_direction_order(self):
        dal = DataAccessLayer()
        inst = _seed_instrument(dal)
        eng = _engine(dal)
        pos = _open_position(dal, inst, engine=EngineType.TURBO,
                             direction=Direction.SHORT, entry="100", qty=10)
        out = close_position(eng, pos, Decimal("95"), uuid4(), at=_now())
        assert out.closed and out.order.direction == Direction.SHORT


# --------------------------------------------------------------------------- #
# EX-3 — target close capability
# --------------------------------------------------------------------------- #
class TestTargetClose:
    def test_paper_target_closes(self):
        dal = DataAccessLayer()
        inst = _seed_instrument(dal)
        eng = _engine(dal)
        pos = _open_position(dal, inst)
        target = PaperTarget(eng, clock=_now)
        closed = target.handle_close(pos, Decimal("140"), user_id=uuid4(), at=_now())
        assert closed is not None and closed.status == PositionStatus.CLOSED

    def test_signals_only_close_is_noop(self):
        dal = DataAccessLayer()
        inst = _seed_instrument(dal)
        pos = _open_position(dal, inst)
        result = SignalsOnlyTarget().handle_close(pos, Decimal("140"), user_id=uuid4())
        assert result is None


# --------------------------------------------------------------------------- #
# EX-4 — orchestrator exit stage
# --------------------------------------------------------------------------- #
def _core_spec(symbol="AAPL"):
    return {
        "symbol": symbol, "direction": "Long",
        "rs_rating": "95", "rvol": "2.5", "adv": 1_000_000, "trend_stage2": True,
        "breakout": {"new_52w_high": True, "base_breakout": True, "base_days": 60},
        "earnings": {"surprise_positive": True, "days_since": 3, "aligned": True},
    }


def _spec(symbol="AAPL", *, mark="150.00", core=None):
    return {
        "captured_at": _now(),
        "market_open": True,
        "market_facts": {"spy_price": "500", "spy_sma_200": "470", "adx": "25"},
        "core": [_core_spec(symbol)] if core is None else core,
        "turbo": [],
        "marks": {symbol: mark},
    }


def _app(dal):
    return build_application(dal, starting_capital=_CAP)


def _orch(dal, app, *, target=None):
    target = target or PaperTarget(_engine(dal))
    return PipelineOrchestrator.from_application(
        app, execution_target=target, sizing_policy=SizingPolicy(),
        capital_settings=CapitalSettings(_CAP, Decimal("0.10")),
        operator_user_id=uuid4(), clock=_now,
    )


def _open_via_cycle(dal, app, orch):
    """Run one cycle that opens a Core AAPL position at mark 150."""
    res = orch.run_cycle(ReplayMarketDataProvider([_spec("AAPL", mark="150.00")],
                                                  clock=_now).poll())
    assert res.executed == 1 and app.portfolio_state.open_count == 1
    return res


class TestOrchestratorExitStage:
    def test_hard_stop_closes_open_position_next_cycle(self):
        dal = DataAccessLayer()
        _seed_instrument(dal, "AAPL")
        app = _app(dal)
        orch = _orch(dal, app)
        _open_via_cycle(dal, app, orch)

        # next cycle: no new candidates, adverse mark below the 8% Core hard stop.
        res = orch.run_cycle(
            ReplayMarketDataProvider([_spec("AAPL", mark="137.00", core=[])],
                                     clock=_now).poll()
        )
        assert res.state == COMPLETED
        assert res.closed == 1
        assert app.portfolio_state.open_count == 0
        assert dal.positions.count(status=PositionStatus.CLOSED) == 1
        closed = dal.positions.list(status=PositionStatus.CLOSED)[0]
        assert closed.exit_price == Decimal("137.00")
        # realized PnL reflected in cash: (137-150)*66 = -858
        assert app.portfolio_state.account.cash == _CAP + Decimal("-858")

    def test_winner_holds_when_mark_flat(self):
        dal = DataAccessLayer()
        _seed_instrument(dal, "AAPL")
        app = _app(dal)
        orch = _orch(dal, app)
        _open_via_cycle(dal, app, orch)
        # flat mark, no candidates → position holds (winners run; no stop hit).
        res = orch.run_cycle(
            ReplayMarketDataProvider([_spec("AAPL", mark="150.00", core=[])],
                                     clock=_now).poll()
        )
        assert res.closed == 0 and app.portfolio_state.open_count == 1

    def test_l4_halts_exits(self):
        dal = DataAccessLayer()
        _seed_instrument(dal, "AAPL")
        app = _app(dal)
        orch = _orch(dal, app)
        _open_via_cycle(dal, app, orch)
        app.kill_switch_cache.record(level=4)
        res = orch.run_cycle(
            ReplayMarketDataProvider([_spec("AAPL", mark="100.00", core=[])],
                                     clock=_now).poll()
        )
        assert res.state == HALTED
        assert res.closed == 0
        assert app.portfolio_state.open_count == 1  # exits halted at L4

    def test_exits_run_at_l1(self):
        dal = DataAccessLayer()
        _seed_instrument(dal, "AAPL")
        app = _app(dal)
        orch = _orch(dal, app)
        _open_via_cycle(dal, app, orch)
        app.kill_switch_cache.record(level=1)
        res = orch.run_cycle(
            ReplayMarketDataProvider([_spec("AAPL", mark="137.00", core=[])],
                                     clock=_now).poll()
        )
        # scanner paused, but the risk-reducing exit still ran.
        assert res.state == PAUSED_SCANNER
        assert res.closed == 1
        assert app.portfolio_state.open_count == 0


# --------------------------------------------------------------------------- #
# EX-5 — end-to-end: D14 now sees a real closed trade
# --------------------------------------------------------------------------- #
class TestEndToEndValidationSeesClose:
    def test_d14_counts_the_closed_round_trip(self):
        dal = DataAccessLayer()
        _seed_instrument(dal, "AAPL")
        app = _app(dal)
        orch = _orch(dal, app)
        _open_via_cycle(dal, app, orch)
        orch.run_cycle(
            ReplayMarketDataProvider([_spec("AAPL", mark="137.00", core=[])],
                                     clock=_now).poll()
        )
        report = compute_validation_metrics(dal, _CAP, now=_now())
        assert report.trades == 1          # previously always 0 (the blocker)
        assert report.losses == 1          # (137-150) < 0
