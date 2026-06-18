"""OR-2 — deterministic paper-validation campaign replay.

Runs the full campaign fixture through the composed app (P-DATA -> D3 -> D4 ->
P-SIZE -> Paper -> exit leg -> Portfolio) and asserts the campaign requirements:
>=30 trading days, >=200 CLOSED trades, Bull+Bear, Long+Short, deterministic,
all D14 metrics computable, seed coverage for every traded symbol.
"""

from __future__ import annotations

from decimal import Decimal
from uuid import uuid4

from src.data_access.dal import DataAccessLayer
from src.enums import PositionStatus
from src.app.bootstrap import build_application
from src.app.marketdata import ReplayMarketDataProvider
from src.app.marketdata.campaign_fixture import (
    ALLOCATION_FRACTION,
    STARTING_CAPITAL,
    UNIVERSE,
    build_campaign,
    seed_universe,
)
from src.app.orchestrator import PipelineOrchestrator
from src.app.sizing import CapitalSettings, SizingPolicy
from src.app.targets.paper import PaperBrokerSyncContract, PaperTarget
from src.app.validation.metrics import compute_validation_metrics
from src.execution.engine import ExecutionEngine


def _run_campaign():
    """Drive the deterministic replay; return (dal, report)."""
    specs = build_campaign()
    dal = DataAccessLayer()
    seed_universe(dal)

    from datetime import datetime
    holder = {"t": datetime.fromisoformat(specs[0]["captured_at"])}
    clock = lambda: holder["t"]  # noqa: E731 (advancing sim clock for determinism)

    app = build_application(dal, starting_capital=STARTING_CAPITAL, clock=clock)
    target = PaperTarget(ExecutionEngine(dal, broker_sync=PaperBrokerSyncContract()))
    orch = PipelineOrchestrator.from_application(
        app, execution_target=target, sizing_policy=SizingPolicy(),
        capital_settings=CapitalSettings(STARTING_CAPITAL, ALLOCATION_FRACTION),
        operator_user_id=uuid4(), clock=clock,
    )
    provider = ReplayMarketDataProvider(specs, clock=clock)
    while not provider.exhausted():
        frame = provider.poll()
        holder["t"] = frame.captured_at
        orch.run_cycle(frame)

    report = compute_validation_metrics(dal, STARTING_CAPITAL, now=holder["t"])
    return dal, report


def test_campaign_produces_required_population():
    dal, report = _run_campaign()
    # >=200 CLOSED round-trips over >=30 trading days
    assert report.trades >= 200
    assert dal.positions.count(status=PositionStatus.CLOSED) == report.trades
    assert report.span_days >= 30
    assert report.active_trading_days >= 30


def test_regime_and_direction_coverage():
    _dal, report = _run_campaign()
    assert report.long_tested and report.short_tested          # both directions
    assert len(report.regimes_observed) >= 2                    # Bull + Bear
    assert len(report.by_direction) == 2


def test_all_d14_metrics_computable():
    _dal, report = _run_campaign()
    # wins AND losses present -> profit factor and R-proxy are real (not None)
    assert report.wins > 0 and report.losses > 0
    assert report.gross_profit > 0 and report.gross_loss > 0
    assert report.profit_factor is not None
    assert report.avg_r_multiple_proxy is not None
    # equity-curve metrics: a real drawdown occurred and was recovered
    assert report.max_drawdown < Decimal("0")
    assert report.recovered is True
    assert report.portfolio_return > Decimal("0")
    assert report.max_consecutive_wins >= 1 and report.max_consecutive_losses >= 1
    # breakdowns are populated and attributed (not degenerate)
    assert len(report.by_sector) >= 2
    assert len(report.by_score_band) >= 1
    assert all(b.key != "unknown" for b in report.by_score_band)  # band attributed


def test_seed_coverage_for_every_traded_symbol():
    dal, _report = _run_campaign()
    traded = {p.instrument_id for p in dal.positions.list(status=PositionStatus.CLOSED)}
    assert len(traded) == len(UNIVERSE)
    for inst_id in traded:
        assert dal.instruments.get_or_none(inst_id) is not None


def test_replay_is_deterministic():
    assert build_campaign() == build_campaign()
    _d1, r1 = _run_campaign()
    _d2, r2 = _run_campaign()
    assert (r1.trades, r1.wins, r1.losses, r1.ending_equity) == \
           (r2.trades, r2.wins, r2.losses, r2.ending_equity)
