"""F-8 — P-ORCH now feeds the full D4 input set.

Before F-8 the orchestrator passed only `daily_drawdown` (= overall snapshot
drawdown); `weekly_drawdown` and the sector-exposure inputs defaulted to 0, so
the WeeklyDrawdown and SectorExposure gates could NEVER bind in the autonomous
flow. These tests prove all three now bind with windowed/relayed D6 figures.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

from src.data_access.dal import DataAccessLayer
from src.enums import Direction, EngineType, Market, PositionStatus
from src.models import Instrument, Position, Sector
from src.app.bootstrap import build_application
from src.app.marketdata import ReplayMarketDataProvider
from src.app.orchestrator import PipelineOrchestrator
from src.app.sizing import CapitalSettings, SizingPolicy
from src.app.targets import PaperTarget
from src.app.targets.paper import PaperBrokerSyncContract
from src.execution.engine import ExecutionEngine

_UTC = timezone.utc
_CAP = Decimal("100000")


def _now() -> datetime:
    return datetime(2026, 6, 10, 14, 30, tzinfo=_UTC)


def _sector(dal) -> Sector:
    sec = Sector(id=uuid4(), name=f"S-{uuid4().hex[:6]}", created_at=_now())
    dal.sectors.add(sec)
    return sec


def _instrument(dal, symbol, sector) -> Instrument:
    inst = Instrument(id=uuid4(), symbol=symbol, market=Market.NASDAQ,
                      sector_id=sector.id, created_at=_now())
    dal.instruments.add(inst)
    return inst


def _engine(dal):
    return ExecutionEngine(dal, broker_sync=PaperBrokerSyncContract())


def _app(dal):
    return build_application(dal, starting_capital=_CAP)


def _orch(dal, app):
    return PipelineOrchestrator.from_application(
        app, execution_target=PaperTarget(_engine(dal)), sizing_policy=SizingPolicy(),
        capital_settings=CapitalSettings(_CAP, Decimal("0.10")),
        operator_user_id=uuid4(), clock=_now,
    )


def _core_spec(symbol):
    return {
        "symbol": symbol, "direction": "Long",
        "rs_rating": "95", "rvol": "2.5", "adv": 1_000_000, "trend_stage2": True,
        "breakout": {"new_52w_high": True, "base_breakout": True, "base_days": 60},
        "earnings": {"surprise_positive": True, "days_since": 3, "aligned": True},
    }


def _spec(symbol, *, mark="150.00"):
    return {
        "captured_at": _now(), "market_open": True,
        "market_facts": {"spy_price": "500", "spy_sma_200": "470", "adx": "25"},
        "core": [_core_spec(symbol)], "turbo": [], "marks": {symbol: mark},
    }


def _run(dal, orch, symbol, mark="150.00"):
    return orch.run_cycle(ReplayMarketDataProvider([_spec(symbol, mark=mark)],
                                                   clock=_now).poll())


def _seed_closed_loss(dal, inst, *, entry, exit_, qty, closed_at):
    dal.positions.add(Position(
        id=uuid4(), instrument_id=inst.id, engine=EngineType.CORE,
        direction=Direction.LONG, status=PositionStatus.CLOSED, quantity=qty,
        opened_at=closed_at - timedelta(hours=1), entry_price=Decimal(entry),
        exit_price=Decimal(exit_), closed_at=closed_at,
    ))


# --------------------------------------------------------------------------- #
# Sector exposure gate now binds
# --------------------------------------------------------------------------- #
def test_sector_gate_binds_when_concentration_exceeds_limit():
    dal = DataAccessLayer()
    sec = _sector(dal)
    _instrument(dal, "AAA", sec)
    _instrument(dal, "BBB", sec)
    _instrument(dal, "CCC", sec)  # all three in ONE sector
    app = _app(dal)
    orch = _orch(dal, app)

    # open two ~10% positions in the sector (each passes: 0/0.1 then 0.1/0.2)
    assert _run(dal, orch, "AAA").executed == 1
    assert _run(dal, orch, "BBB").executed == 1
    # third candidate: current 0.198 + added 0.10 = 0.298 > 0.25 -> rejected
    res = _run(dal, orch, "CCC")
    assert res.executed == 0 and res.accepted == 0
    assert dal.risk_checks.list()[-1].rejected_by == "SectorExposure"


# --------------------------------------------------------------------------- #
# Weekly drawdown gate now binds (daily passes — distinct windows)
# --------------------------------------------------------------------------- #
def test_weekly_drawdown_gate_binds_while_daily_passes():
    dal = DataAccessLayer()
    sec = _sector(dal)
    inst = _instrument(dal, "AAA", sec)
    app = _app(dal)
    orch = _orch(dal, app)
    # a -7% realized loss closed 3 days ago: inside the week, before today.
    _seed_closed_loss(dal, inst, entry="150", exit_="80", qty=100,
                      closed_at=_now() - timedelta(days=3))

    res = _run(dal, orch, "AAA")
    assert res.accepted == 0
    # daily window has no in-window close (folded into baseline) -> daily passes;
    # the weekly window sees the -7% -> WeeklyDrawdown is the binding gate.
    assert dal.risk_checks.list()[-1].rejected_by == "WeeklyDrawdown"


# --------------------------------------------------------------------------- #
# Daily drawdown gate now binds on a windowed realized figure
# --------------------------------------------------------------------------- #
def test_daily_drawdown_gate_binds_on_today_loss():
    dal = DataAccessLayer()
    sec = _sector(dal)
    inst = _instrument(dal, "AAA", sec)
    app = _app(dal)
    orch = _orch(dal, app)
    # a -4% realized loss closed TODAY -> daily window sees it.
    _seed_closed_loss(dal, inst, entry="150", exit_="110", qty=100, closed_at=_now())

    res = _run(dal, orch, "AAA")
    assert res.accepted == 0
    assert dal.risk_checks.list()[-1].rejected_by == "DailyDrawdown"


# --------------------------------------------------------------------------- #
# No regression: clean book still trades (all fed gates pass)
# --------------------------------------------------------------------------- #
def test_clean_book_still_executes():
    dal = DataAccessLayer()
    sec = _sector(dal)
    _instrument(dal, "AAA", sec)
    app = _app(dal)
    orch = _orch(dal, app)
    res = _run(dal, orch, "AAA")
    assert res.executed == 1 and app.portfolio_state.open_count == 1
