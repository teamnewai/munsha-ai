"""THUL-NURAYN v1 — P-ORCH orchestrator tests (always-run, in-memory).

Verifies the autonomous conductor against the required checklist: startup/
recovery wiring, kill-switch behavior (L1–L4), scheduler behavior, data-quality
gate (Reject Cycle), duplicate-action prevention, audit-trail generation, and the
full P-DATA → D3 → D4 → P-SIZE → Execution Target → Portfolio flow. No broker,
no network, no live trading (Paper target only).
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

import pytest

from src.data_access.dal import DataAccessLayer
from src.enums import (
    Direction,
    EngineType,
    Market,
    OrderStatus,
    PositionStatus,
    SystemEventType,
)
from src.models import Instrument, Sector
from src.app.bootstrap import build_application
from src.app.marketdata import ReplayMarketDataProvider
from src.app.orchestrator import (
    COMPLETED,
    HALTED,
    PAUSED_SCANNER,
    REJECTED,
    PipelineOrchestrator,
    TradingCycleWorker,
)
from src.app.sizing import CapitalSettings, SizingPolicy
from src.app.targets import PaperTarget, SignalsOnlyTarget
from src.app.targets.paper import PaperBrokerSyncContract
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


def _core_spec(symbol="AAPL"):
    # values chosen so D3 Core scores it well (UltraGolden) in a Bull regime
    return {
        "symbol": symbol, "direction": "Long",
        "rs_rating": "95", "rvol": "2.5", "adv": 1_000_000, "trend_stage2": True,
        "breakout": {"new_52w_high": True, "base_breakout": True, "base_days": 60},
        "earnings": {"surprise_positive": True, "days_since": 3, "aligned": True},
    }


def _spec(symbol="AAPL", **over):
    base = {
        "captured_at": _now(),
        "market_open": True,
        "market_facts": {"spy_price": "500", "spy_sma_200": "470", "adx": "25"},
        "core": [_core_spec(symbol)],
        "turbo": [],
        "marks": {symbol: "150.00"},
    }
    base.update(over)
    return base


def _app(dal):
    # build_application with explicit in-memory DAL (B9), no pool/redis
    return build_application(dal, starting_capital=_CAP)


def _orch(dal, app, *, target=None):
    target = target or PaperTarget(ExecutionEngine(dal, broker_sync=PaperBrokerSyncContract()))
    return PipelineOrchestrator.from_application(
        app,
        execution_target=target,
        sizing_policy=SizingPolicy(),
        capital_settings=CapitalSettings(_CAP, Decimal("0.10")),
        operator_user_id=uuid4(),
        clock=_now,
    )


def _frame(dal, specs):
    return ReplayMarketDataProvider(specs, clock=_now)


# --------------------------------------------------------------------------- #
# Full orchestration flow: P-DATA -> D3 -> D4 -> P-SIZE -> Paper -> Portfolio
# --------------------------------------------------------------------------- #

class TestFullFlow:
    def test_end_to_end_paper_cycle(self):
        dal = DataAccessLayer()
        _seed_instrument(dal, "AAPL")
        app = _app(dal)
        orch = _orch(dal, app)
        frame = _frame(dal, [_spec("AAPL")]).poll()

        res = orch.run_cycle(frame)

        assert res.state == COMPLETED
        assert res.scored >= 1
        assert res.accepted >= 1
        assert res.executed == 1
        # decisions persisted (D1 rows)
        assert dal.signals.count() == res.scored
        assert dal.scores.count() == res.scored
        assert dal.risk_checks.count() == res.scored
        # paper order filled + position open + portfolio reflects it
        assert dal.orders.count(status=OrderStatus.FILLED) == 1
        assert dal.positions.count(status=PositionStatus.OPEN) == 1
        assert app.portfolio_state.open_count == 1
        # broker_ref paper tag (no live)
        order = dal.orders.list(status=OrderStatus.FILLED)[0]
        assert order.broker_ref.startswith("paper:")

    def test_signals_only_target_creates_no_order(self):
        dal = DataAccessLayer()
        _seed_instrument(dal, "AAPL")
        app = _app(dal)
        orch = _orch(dal, app, target=SignalsOnlyTarget())
        res = orch.run_cycle(_frame(dal, [_spec("AAPL")]).poll())
        assert res.accepted >= 1
        assert res.executed == 0
        assert dal.orders.count() == 0
        assert dal.positions.count() == 0


# --------------------------------------------------------------------------- #
# Data-quality gate
# --------------------------------------------------------------------------- #

class TestDataQualityGate:
    def test_market_closed_rejects_cycle(self):
        dal = DataAccessLayer()
        _seed_instrument(dal, "AAPL")
        app = _app(dal)
        orch = _orch(dal, app)
        frame = _frame(dal, [_spec("AAPL", market_open=False)]).poll()
        res = orch.run_cycle(frame)
        assert res.state == REJECTED
        assert dal.orders.count() == 0          # no trade
        assert app.dlq.depth() == 1             # dead-lettered
        # data-quality audit recorded
        evs = dal.system_events.list(event_type=SystemEventType.GATEWAY_EVENT)
        assert any((e.detail or {}).get("kind") == "data_quality_reject" for e in evs)

    def test_missing_spy_rejects_cycle(self):
        dal = DataAccessLayer()
        _seed_instrument(dal, "AAPL")
        app = _app(dal)
        orch = _orch(dal, app)
        bad = _spec("AAPL", market_facts={"spy_price": None, "spy_sma_200": "470"})
        frame = _frame(dal, [bad]).poll()
        res = orch.run_cycle(frame)
        assert res.state == REJECTED and dal.orders.count() == 0


# --------------------------------------------------------------------------- #
# Kill-switch behavior (highest priority)
# --------------------------------------------------------------------------- #

class TestKillSwitch:
    def _setup(self):
        dal = DataAccessLayer()
        _seed_instrument(dal, "AAPL")
        app = _app(dal)
        orch = _orch(dal, app)
        return dal, app, orch

    def test_l4_shutdown_no_activity(self):
        dal, app, orch = self._setup()
        app.kill_switch_cache.record(level=4)
        res = orch.run_cycle(_frame(dal, [_spec("AAPL")]).poll())
        assert res.state == HALTED
        assert dal.orders.count() == 0 and dal.signals.count() == 0

    def test_l1_pauses_scanner(self):
        dal, app, orch = self._setup()
        app.kill_switch_cache.record(level=1)
        res = orch.run_cycle(_frame(dal, [_spec("AAPL")]).poll())
        assert res.state == PAUSED_SCANNER
        assert dal.signals.count() == 0  # no scan/score
        assert dal.orders.count() == 0

    def test_l3_pauses_execution_but_scores_and_gates(self):
        dal, app, orch = self._setup()
        app.kill_switch_cache.record(level=3)
        res = orch.run_cycle(_frame(dal, [_spec("AAPL")]).poll())
        # scored + risk-checked (audit) but NOT executed
        assert dal.signals.count() >= 1
        assert dal.risk_checks.count() >= 1
        assert dal.orders.count() == 0
        assert res.executed == 0

    def test_l2_blocks_new_trades_via_d4(self):
        dal, app, orch = self._setup()
        app.kill_switch_cache.record(level=2)
        res = orch.run_cycle(_frame(dal, [_spec("AAPL")]).poll())
        # D4 KillSwitchGate rejects; signal/score/risk_check recorded, no order
        assert dal.signals.count() >= 1
        assert res.accepted == 0
        assert dal.orders.count() == 0


# --------------------------------------------------------------------------- #
# Scheduler behavior + duplicate-action prevention
# --------------------------------------------------------------------------- #

class TestSchedulerAndDuplicates:
    def test_worker_runs_one_cycle_per_tick(self):
        dal = DataAccessLayer()
        _seed_instrument(dal, "AAPL")
        app = _app(dal)
        orch = _orch(dal, app)
        provider = _frame(dal, [_spec("AAPL", bar_id="B1"), _spec("AAPL", bar_id="B2")])
        w = TradingCycleWorker(orch, provider, interval=1.0)
        w.run_once()
        assert w.last_result.state == COMPLETED
        w.run_once()  # second frame
        w.run_once()  # exhausted -> no-op, must not raise
        assert dal.orders.count(status=OrderStatus.FILLED) == 2

    def test_scheduler_isolates_cycle_failure(self):
        from src.operations.scheduler import Scheduler
        dal = DataAccessLayer()
        app = _app(dal)
        sched = Scheduler(dal, alert_manager=app.alert_manager, dlq=app.dlq)

        class _BadWorker(TradingCycleWorker):
            def run_once(self):
                raise RuntimeError("boom")

        sched.register(_BadWorker(_orch(dal, app), _frame(dal, [_spec("AAPL")])))
        sched.run_all_once()  # must not raise
        assert dal.system_events.count(event_type=SystemEventType.WORKER_FAILURE) >= 1

    def test_duplicate_signal_blocked_by_d5(self):
        # Same fingerprint while an order is live -> D5 DuplicateOrderProtection
        from src.execution.errors import DuplicateOrderError
        from src.execution.requests import OrderRequest
        dal = DataAccessLayer()
        inst = _seed_instrument(dal, "AAPL")
        engine = ExecutionEngine(dal, broker_sync=PaperBrokerSyncContract())
        target = PaperTarget(engine)
        # pre-register a live order with a fixed signal_id
        sid = uuid4()
        live = engine.create_order(OrderRequest(
            instrument_id=inst.id, user_id=uuid4(), engine=EngineType.CORE,
            direction=Direction.LONG, quantity=10, signal_id=sid))
        engine.submit_order(live)
        # an ExecutionIntent reusing the same signal id must be blocked by D5
        from src.app.targets.base import ExecutionIntent
        from src.models import Signal
        sig = Signal(id=sid, created_at=_now(), instrument_id=inst.id,
                     engine=EngineType.CORE, direction=Direction.LONG)
        with pytest.raises(DuplicateOrderError):
            target.handle_accepted(ExecutionIntent(signal=sig, user_id=uuid4(),
                                                   quantity=10, mark=Decimal("150")))


# --------------------------------------------------------------------------- #
# Audit trail + no-bypass + recovery wiring
# --------------------------------------------------------------------------- #

class TestAuditAndInvariants:
    def test_every_stage_leaves_a_trace(self):
        dal = DataAccessLayer()
        _seed_instrument(dal, "AAPL")
        app = _app(dal)
        orch = _orch(dal, app)
        orch.run_cycle(_frame(dal, [_spec("AAPL")]).poll())
        evs = dal.system_events.list(event_type=SystemEventType.GATEWAY_EVENT)
        kinds = {(e.detail or {}).get("kind") for e in evs}
        assert "scan" in kinds                  # Selection stage
        assert "cycle_summary" in kinds         # Reporting stage
        assert dal.scores.count() >= 1          # Score stage (D1 rows)
        assert dal.risk_checks.count() >= 1     # Risk stage (D1 rows)
        assert dal.audit_logs.count() >= 1      # Execution stage (D5 AuditEventFlow)

    def test_no_order_without_clearing_chain(self):
        # unknown instrument -> no signal/order despite a scored candidate
        dal = DataAccessLayer()  # no instrument seeded
        app = _app(dal)
        orch = _orch(dal, app)
        res = orch.run_cycle(_frame(dal, [_spec("AAPL")]).poll())
        assert dal.orders.count() == 0
        assert res.executed == 0

    def test_recovery_wired_via_application(self):
        # B9 recovery already ran in build_application; orchestrator uses the
        # recovered portfolio_state / duplicate protection / kill-switch cache.
        dal = DataAccessLayer()
        _seed_instrument(dal, "AAPL")
        app = _app(dal)
        assert app.portfolio_state is not None
        assert app.kill_switch_cache.current_level() == 0
        orch = _orch(dal, app)
        res = orch.run_cycle(_frame(dal, [_spec("AAPL")]).poll())
        assert res.state == COMPLETED


# --------------------------------------------------------------------------- #
# No forbidden coupling
# --------------------------------------------------------------------------- #

class TestNoForbiddenCoupling:
    def test_orchestrator_has_no_broker_or_vendor_imports(self):
        import src.app.orchestrator as mod
        src = open(mod.__file__).read().lower()
        for forbidden in ("import requests", "import socket", "urllib", "ib_insync",
                          "yfinance", "polygon", "tradingview"):
            assert forbidden not in src
