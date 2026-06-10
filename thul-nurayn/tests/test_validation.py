"""THUL-NURAYN v1 — D14 validation reporting tests (always-run, in-memory).

Read-only measurement over persisted paper data: metrics (win rate, profit
factor, R-proxy, max drawdown, recovery, streaks, portfolio return, breakdowns),
period reports (existing performance_records), regime/direction coverage, and the
Pass/Fail eligibility gate. No writes to domain data; no recommendations.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from src.data_access.dal import DataAccessLayer
from src.enums import (
    Direction,
    EngineType,
    PositionStatus,
    SeverityLevel,
    SystemEventType,
    TradeClassification,
)
from src.models import (
    Instrument,
    Order,
    Position,
    Score,
    Sector,
    Signal,
)
from src.operations.events import emit_system_event
from src.app.validation import (
    GateResult,
    ValidationReporter,
    ValidationThresholds,
    compute_validation_metrics,
    evaluate,
)

_UTC = timezone.utc
_CAP = Decimal("100000")


def _t(day=1, hour=16):
    return datetime(2026, 6, day, hour, tzinfo=_UTC)


def _closed(dal, *, symbol, direction, entry, ex_, qty=100, opened=None, closed=None,
            sector_id=None, classification=None):
    """Persist a CLOSED position (+ optional instrument/order/score for breakdowns)."""
    if sector_id is None:
        sec = Sector(id=uuid4(), name=f"S-{uuid4().hex[:6]}", created_at=_t())
        dal.sectors.add(sec)
        sector_id = sec.id
    instr = Instrument(id=uuid4(), symbol=symbol, market=__import__(
        "src.enums", fromlist=["Market"]).Market.NASDAQ, sector_id=sector_id,
        created_at=_t())
    dal.instruments.add(instr)
    pos = Position(
        id=uuid4(), instrument_id=instr.id, engine=EngineType.CORE,
        direction=direction, status=PositionStatus.CLOSED, quantity=qty,
        opened_at=opened or _t(1), entry_price=Decimal(str(entry)),
        exit_price=Decimal(str(ex_)), closed_at=closed or _t(2))
    dal.positions.add(pos)
    if classification is not None:
        sig = Signal(id=uuid4(), created_at=_t(1), instrument_id=instr.id,
                     engine=EngineType.CORE, direction=direction)
        dal.signals.add(sig)
        dal.scores.add(Score(id=uuid4(), signal_id=sig.id, engine=EngineType.CORE,
                             total=Decimal("95"), classification=classification,
                             created_at=_t(1)))
        dal.orders.add(Order(id=uuid4(), created_at=_t(1), instrument_id=instr.id,
                             user_id=uuid4(), engine=EngineType.CORE,
                             direction=direction, status=__import__(
                                 "src.enums", fromlist=["OrderStatus"]).OrderStatus.FILLED,
                             quantity=qty, signal_id=sig.id, position_id=pos.id))
    return pos


# --------------------------------------------------------------------------- #
# Metrics
# --------------------------------------------------------------------------- #

class TestMetrics:
    def test_basic_win_loss_pnl(self):
        dal = DataAccessLayer()
        # 2 winners (+500 each), 1 loser (-200): Long (exit-entry)*qty
        _closed(dal, symbol="A", direction=Direction.LONG, entry=10, ex_=15)   # +500
        _closed(dal, symbol="B", direction=Direction.LONG, entry=10, ex_=15)   # +500
        _closed(dal, symbol="C", direction=Direction.LONG, entry=10, ex_=8)    # -200
        r = compute_validation_metrics(dal, _CAP)
        assert r.trades == 3 and r.wins == 2 and r.losses == 1
        assert r.win_rate == Decimal(2) / Decimal(3)
        assert r.gross_profit == Decimal("1000")
        assert r.gross_loss == Decimal("200")
        assert r.profit_factor == Decimal("1000") / Decimal("200")  # 5.0
        assert r.portfolio_return == Decimal("800") / _CAP

    def test_profit_factor_none_when_no_losses(self):
        dal = DataAccessLayer()
        _closed(dal, symbol="A", direction=Direction.LONG, entry=10, ex_=12)
        r = compute_validation_metrics(dal, _CAP)
        assert r.profit_factor is None
        assert r.gross_profit > 0

    def test_short_pnl(self):
        dal = DataAccessLayer()
        # Short winner: (entry-exit)*qty = (20-15)*100 = +500
        _closed(dal, symbol="S", direction=Direction.SHORT, entry=20, ex_=15)
        r = compute_validation_metrics(dal, _CAP)
        assert r.wins == 1 and r.gross_profit == Decimal("500")
        assert r.short_tested is True and r.long_tested is False

    def test_max_drawdown_and_recovery(self):
        dal = DataAccessLayer()
        # sequence: +1000 (HWM up), -3000 (drawdown), +5000 (recover past HWM)
        _closed(dal, symbol="A", direction=Direction.LONG, entry=10, ex_=20, qty=100,
                closed=_t(2))   # +1000
        _closed(dal, symbol="B", direction=Direction.LONG, entry=10, ex_=-20, qty=100,
                closed=_t(3))   # -3000
        _closed(dal, symbol="C", direction=Direction.LONG, entry=10, ex_=60, qty=100,
                closed=_t(4))   # +5000
        r = compute_validation_metrics(dal, _CAP)
        assert r.max_drawdown < Decimal("0")     # a drawdown occurred
        assert r.recovered is True               # ended at a new HWM

    def test_unrecovered_drawdown(self):
        dal = DataAccessLayer()
        _closed(dal, symbol="A", direction=Direction.LONG, entry=10, ex_=20, qty=100,
                closed=_t(2))   # +1000 -> HWM
        _closed(dal, symbol="B", direction=Direction.LONG, entry=10, ex_=5, qty=100,
                closed=_t(3))   # -500 -> still below HWM at end
        r = compute_validation_metrics(dal, _CAP)
        assert r.recovered is False

    def test_consecutive_streaks(self):
        dal = DataAccessLayer()
        for i, exit_px in enumerate([15, 15, 8, 15, 15, 15]):  # W W L W W W
            _closed(dal, symbol=f"X{i}", direction=Direction.LONG, entry=10,
                    ex_=exit_px, closed=_t(2 + i))
        r = compute_validation_metrics(dal, _CAP)
        assert r.max_consecutive_wins == 3
        assert r.max_consecutive_losses == 1

    def test_r_multiple_proxy_labeled(self):
        dal = DataAccessLayer()
        _closed(dal, symbol="A", direction=Direction.LONG, entry=10, ex_=15)  # +500
        _closed(dal, symbol="B", direction=Direction.LONG, entry=10, ex_=8)   # -200
        r = compute_validation_metrics(dal, _CAP)
        assert r.avg_r_multiple_proxy is not None
        assert "proxy" in r.data_quality["r_multiple"]

    def test_breakdowns_direction_and_band(self):
        dal = DataAccessLayer()
        _closed(dal, symbol="A", direction=Direction.LONG, entry=10, ex_=15,
                classification=TradeClassification.GOLDEN)
        _closed(dal, symbol="B", direction=Direction.SHORT, entry=20, ex_=15,
                classification=TradeClassification.STRONG)
        r = compute_validation_metrics(dal, _CAP)
        dirs = {b.key for b in r.by_direction}
        assert dirs == {"Long", "Short"}
        bands = {b.key for b in r.by_score_band}
        assert "Golden" in bands and "Strong" in bands

    def test_empty_is_safe(self):
        dal = DataAccessLayer()
        r = compute_validation_metrics(dal, _CAP)
        assert r.trades == 0 and r.win_rate == Decimal("0")
        assert r.portfolio_return == Decimal("0") and r.recovered is True


# --------------------------------------------------------------------------- #
# Regime coverage (from scan audit events)
# --------------------------------------------------------------------------- #

class TestRegimeCoverage:
    def test_regimes_observed_from_audit(self):
        dal = DataAccessLayer()
        emit_system_event(dal, SystemEventType.GATEWAY_EVENT, SeverityLevel.WARNING,
                          {"kind": "scan", "regime": "Bull"})
        emit_system_event(dal, SystemEventType.GATEWAY_EVENT, SeverityLevel.WARNING,
                          {"kind": "scan", "regime": "Bear"})
        r = compute_validation_metrics(dal, _CAP)
        assert set(r.regimes_observed) == {"Bull", "Bear"}
        assert r.data_quality["regime_per_trade_attributed"] is False


# --------------------------------------------------------------------------- #
# Period reports (existing performance_records; no schema change)
# --------------------------------------------------------------------------- #

class TestReporter:
    def test_daily_report_persists_performance_record(self):
        dal = DataAccessLayer()
        _closed(dal, symbol="A", direction=Direction.LONG, entry=10, ex_=15,
                closed=_t(2))
        rep = ValidationReporter(dal, _CAP)
        rec = rep.daily_report(_t(1, 0), _t(2, 23))
        assert rec.period_type == "daily" and rec.trades == 1 and rec.wins == 1
        assert dal.performance_records.count() == 1

    def test_cumulative_report(self):
        dal = DataAccessLayer()
        _closed(dal, symbol="A", direction=Direction.LONG, entry=10, ex_=15)
        rep = ValidationReporter(dal, _CAP)
        r = rep.cumulative_report()
        assert r.trades == 1

    def test_reporter_writes_no_domain_rows(self):
        dal = DataAccessLayer()
        _closed(dal, symbol="A", direction=Direction.LONG, entry=10, ex_=15)
        before_positions = dal.positions.count()
        ValidationReporter(dal, _CAP).cumulative_report()
        # cumulative report is read-only: no positions/orders created
        assert dal.positions.count() == before_positions


# --------------------------------------------------------------------------- #
# Pass/Fail gate (eligibility; read-only)
# --------------------------------------------------------------------------- #

class TestGate:
    def _passing_report(self):
        # synthesize a report object directly via metrics on crafted data is heavy;
        # build a minimal ValidationReport-like via compute on a passing dataset.
        dal = DataAccessLayer()
        # 200 trades won't be created; instead use small thresholds to test logic
        _closed(dal, symbol="A", direction=Direction.LONG, entry=10, ex_=15)
        _closed(dal, symbol="B", direction=Direction.SHORT, entry=20, ex_=15)
        emit_system_event(dal, SystemEventType.GATEWAY_EVENT, SeverityLevel.WARNING,
                          {"kind": "scan", "regime": "Bull"})
        emit_system_event(dal, SystemEventType.GATEWAY_EVENT, SeverityLevel.WARNING,
                          {"kind": "scan", "regime": "Bear"})
        return compute_validation_metrics(dal, _CAP)

    def test_passes_with_relaxed_thresholds(self):
        r = self._passing_report()
        t = ValidationThresholds(min_duration_days=0, min_trades=2,
                                 min_win_rate=Decimal("0.5"),
                                 min_profit_factor=Decimal("1.0"))
        res = evaluate(r, t)
        assert isinstance(res, GateResult)
        assert res.passed is True
        assert res.failures == ()

    def test_fails_on_default_policy_thresholds(self):
        # only 2 trades -> fails 30d/200-trade policy
        r = self._passing_report()
        res = evaluate(r)  # default = owner policy (200 trades, 85% etc.)
        assert res.passed is False
        assert "trades" in res.failures
        assert "win_rate" in res.failures or "duration" in res.failures

    def test_profit_factor_none_passes_when_profitable(self):
        dal = DataAccessLayer()
        _closed(dal, symbol="A", direction=Direction.LONG, entry=10, ex_=12)  # no losses
        r = compute_validation_metrics(dal, _CAP)
        t = ValidationThresholds(min_duration_days=0, min_trades=1,
                                 min_win_rate=Decimal("0"), min_regimes=0,
                                 require_long_and_short=False)
        res = evaluate(r, t)
        assert res.criteria["profit_factor"][0] is True


# --------------------------------------------------------------------------- #
# No forbidden coupling
# --------------------------------------------------------------------------- #

class TestNoForbiddenCoupling:
    def test_validation_pkg_has_no_engine_or_vendor_calls(self):
        import os
        import src.app.validation as pkg
        pkg_dir = os.path.dirname(pkg.__file__)
        blob = ""
        for fn in os.listdir(pkg_dir):
            if fn.endswith(".py"):
                blob += open(os.path.join(pkg_dir, fn)).read().lower()
        for forbidden in ("import requests", "import socket", "urllib", "ib_insync",
                          "sklearn", "numpy", "from src.selection.engine",
                          "from src.risk.engine", "from src.execution.engine"):
            assert forbidden not in blob
