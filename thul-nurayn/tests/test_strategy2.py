"""Strategy 2 (PROPOSED) — independence + modifications.

Verifies the second, independent strategy: it applies the quality gate (trades
only Golden+ signals) and its own sound-approach exit config, and behaves
independently of Strategy 1 (the baseline orchestrator), which is unchanged.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from src.data_access.dal import DataAccessLayer
from src.enums import Market, PositionStatus
from src.models import Instrument, Sector
from src.app.bootstrap import build_application
from src.app.marketdata import ReplayMarketDataProvider
from src.app.orchestrator import PipelineOrchestrator
from src.app.sizing import CapitalSettings, SizingPolicy
from src.app.strategy2 import MIN_SCORE, Strategy2Orchestrator, proposed_exit_config
from src.app.targets.paper import PaperBrokerSyncContract, PaperTarget
from src.execution.engine import ExecutionEngine

_UTC = timezone.utc
_CAP = Decimal("100000")


def _now():
    return datetime(2026, 6, 10, 14, 30, tzinfo=_UTC)


def _seed(dal, symbol):
    sec = Sector(id=uuid4(), name=f"S-{uuid4().hex[:6]}", created_at=_now())
    dal.sectors.add(sec)
    dal.instruments.add(Instrument(id=uuid4(), symbol=symbol, market=Market.NASDAQ,
                                   sector_id=sec.id, created_at=_now()))


def _strong_turbo(symbol):  # all factors -> UltraGolden (score 100)
    return {"symbol": symbol, "direction": "Long", "rvol": "3.5", "adv": 1_000_000,
            "atr": "1.20", "premarket_volume": 200_000, "gap_pct": "0.05",
            "above_vwap": True, "catalyst": True, "orb_confirmed": True,
            "momentum_ok": True}


def _weak_turbo(symbol):  # eligible but low score (no catalyst/ORB/momentum)
    return {"symbol": symbol, "direction": "Long", "rvol": "3.5", "adv": 1_000_000,
            "atr": "1.20", "premarket_volume": 200_000, "gap_pct": "0.05",
            "above_vwap": True, "catalyst": False, "orb_confirmed": False,
            "momentum_ok": False}


def _frame(dal, turbos):
    spec = {
        "captured_at": _now(), "market_open": True,
        "market_facts": {"spy_price": "520", "spy_sma_200": "470", "adx": "25"},
        "core": [], "turbo": turbos,
        "marks": {t["symbol"]: "100.00" for t in turbos},
    }
    return ReplayMarketDataProvider([spec], clock=_now).poll()


def _app(dal):
    return build_application(dal, starting_capital=_CAP)


def _target(dal):
    return PaperTarget(ExecutionEngine(dal, broker_sync=PaperBrokerSyncContract()))


def _baseline(dal, app):
    return PipelineOrchestrator.from_application(
        app, execution_target=_target(dal), sizing_policy=SizingPolicy(),
        capital_settings=CapitalSettings(_CAP, Decimal("0.10")),
        operator_user_id=uuid4(), clock=_now)


def _strategy2(dal, app):
    return Strategy2Orchestrator.from_application(
        app, execution_target=_target(dal), sizing_policy=SizingPolicy(),
        capital_settings=CapitalSettings(_CAP, Decimal("0.10")),
        operator_user_id=uuid4(), clock=_now)


# --------------------------------------------------------------------------- #
# Quality gate: Strategy 2 trades only high-band signals
# --------------------------------------------------------------------------- #
def test_strategy2_quality_gate_drops_low_band():
    dal = DataAccessLayer()
    _seed(dal, "AAA")
    _seed(dal, "BBB")
    res = _strategy2(dal, _app(dal)).run_cycle(
        _frame(dal, [_strong_turbo("AAA"), _weak_turbo("BBB")]))
    # only the UltraGolden (AAA) is executed; the low-band (BBB) is gated out.
    assert res.executed == 1
    assert dal.positions.count(status=PositionStatus.OPEN) == 1


def test_baseline_trades_both_bands():
    dal = DataAccessLayer()
    _seed(dal, "AAA")
    _seed(dal, "BBB")
    res = _baseline(dal, _app(dal)).run_cycle(
        _frame(dal, [_strong_turbo("AAA"), _weak_turbo("BBB")]))
    # baseline (Strategy 1) has NO quality gate -> trades both.
    assert res.executed == 2
    assert dal.positions.count(status=PositionStatus.OPEN) == 2


# --------------------------------------------------------------------------- #
# Independent exit configuration
# --------------------------------------------------------------------------- #
def test_strategy2_uses_its_own_exit_config():
    dal = DataAccessLayer()
    s2 = _strategy2(dal, _app(dal))
    base = _baseline(dal, _app(DataAccessLayer()))
    # Strategy 2 = sound-approach config; baseline = provisional defaults. Distinct.
    assert s2._exit.config.turbo_trailing_pct == Decimal("0.03")
    assert s2._exit.config.turbo_hard_stop_pct == Decimal("0.015")
    assert base._exit.config.turbo_trailing_pct == Decimal("0.02")
    assert s2._exit.config != base._exit.config
    assert proposed_exit_config().invalid_reason() is None
    assert MIN_SCORE == Decimal("95")


# --------------------------------------------------------------------------- #
# Independence: the two strategies share no mutable state
# --------------------------------------------------------------------------- #
def test_strategies_are_independent():
    dal1, dal2 = DataAccessLayer(), DataAccessLayer()
    for d in (dal1, dal2):
        _seed(d, "AAA")
        _seed(d, "BBB")
    turbos = [_strong_turbo("AAA"), _weak_turbo("BBB")]

    r1 = _baseline(dal1, _app(dal1)).run_cycle(_frame(dal1, turbos))
    r2 = _strategy2(dal2, _app(dal2)).run_cycle(_frame(dal2, turbos))

    # different behavior, fully separated stores
    assert r1.executed == 2 and r2.executed == 1
    assert dal1.positions.count(status=PositionStatus.OPEN) == 2
    assert dal2.positions.count(status=PositionStatus.OPEN) == 1
