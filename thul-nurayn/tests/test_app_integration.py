"""THUL-NURAYN v1 — B9 Integration & Recovery tests.

Default backend is the in-memory DataAccessLayer (B2), a drop-in for
PostgresDataAccessLayer behind the D2 ABC — so bootstrap/recovery are fully
exercised offline. Health-probe tests use a lightweight fake pool/Redis.

No existing test file is modified; B1–B8 suites are untouched.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest

from src.data_access.dal import DataAccessLayer
from src.enums import (
    Direction,
    EngineType,
    OrderStatus,
    PositionStatus,
    SeverityLevel,
    SystemEventType,
)
from src.models import Order, Position
from src.risk.state import KillSwitchLevel

from src.app.bootstrap import Application, build_application
from src.app.broker_mock import MockBrokerSyncContract
from src.app.catalog import make_list_partitions, make_partition_exists
from src.app.recovery import (
    RiskStateBuilder,
    rebuild_duplicate_protection,
    rebuild_kill_switch,
    rebuild_portfolio_state,
)
from src.operations.killswitch import KillSwitchLevelCache

_UTC = timezone.utc
_CAP = Decimal("100000")


def _ts(**delta) -> datetime:
    return datetime.now(_UTC) + timedelta(**delta)


def _dal() -> DataAccessLayer:
    return DataAccessLayer()


def _closed_pos(engine=EngineType.CORE, entry="10", exit="12", qty=100, closed=None):
    return Position(
        id=uuid4(), instrument_id=uuid4(), engine=engine,
        direction=Direction.LONG, status=PositionStatus.CLOSED, quantity=qty,
        opened_at=_ts(hours=-2), entry_price=Decimal(entry),
        exit_price=Decimal(exit), closed_at=closed or _ts(hours=-1),
    )


def _open_pos(engine=EngineType.CORE, entry="20", qty=50):
    return Position(
        id=uuid4(), instrument_id=uuid4(), engine=engine,
        direction=Direction.LONG, status=PositionStatus.OPEN, quantity=qty,
        opened_at=_ts(hours=-1), entry_price=Decimal(entry),
    )


def _order(status=OrderStatus.NEW, **over):
    base = dict(
        id=uuid4(), created_at=_ts(), instrument_id=uuid4(), user_id=uuid4(),
        engine=EngineType.CORE, direction=Direction.LONG, status=status,
        quantity=100, signal_id=uuid4(), position_id=None, broker_ref=None,
    )
    base.update(over)
    return Order(**base)


# --------------------------------------------------------------------------- #
# Fakes for pool / redis
# --------------------------------------------------------------------------- #

class _Redis:
    def __init__(self, available=True):
        self.available = available
        self._s = {}
    def ping(self): return self.available
    def get(self, k): return self._s.get(k) if self.available else None
    def set(self, k, v, ex=None):
        if not self.available: return None
        self._s[k] = str(v); return True
    def delete(self, k):
        if not self.available: return None
        return self._s.pop(k, None)


# --------------------------------------------------------------------------- #
# §10 kill-switch rebuild
# --------------------------------------------------------------------------- #

class TestKillSwitchRebuild:
    def test_rebuild_zero_when_no_rows(self):
        dal = _dal()
        ks = KillSwitchLevelCache(dal)
        assert rebuild_kill_switch(ks) == 0

    def test_rebuild_recovers_latest_level(self):
        dal = _dal()
        ks = KillSwitchLevelCache(dal)
        ks.record(level=2)
        ks.record(level=4)
        assert rebuild_kill_switch(ks) == 4


# --------------------------------------------------------------------------- #
# §7 PortfolioState rebuild
# --------------------------------------------------------------------------- #

class TestPortfolioRebuild:
    def test_cash_reconstructed_from_closed(self):
        dal = _dal()
        dal.positions.add(_closed_pos(entry="10", exit="12", qty=100))  # +200
        state, open_n, closed_n, anomalies = rebuild_portfolio_state(dal, _CAP)
        assert closed_n == 1 and open_n == 0 and anomalies == []
        snap = state.snapshot({})
        assert snap.cash == _CAP + Decimal("200")

    def test_open_positions_in_registry(self):
        dal = _dal()
        dal.positions.add(_open_pos(qty=50))
        dal.positions.add(_open_pos(qty=10))
        state, open_n, closed_n, _ = rebuild_portfolio_state(dal, _CAP)
        assert open_n == 2 and closed_n == 0
        assert state.open_count == 2

    def test_mixed_closed_and_open(self):
        dal = _dal()
        dal.positions.add(_closed_pos(entry="10", exit="11", qty=100))  # +100
        dal.positions.add(_open_pos())
        state, open_n, closed_n, _ = rebuild_portfolio_state(dal, _CAP)
        assert open_n == 1 and closed_n == 1
        assert state.snapshot({}).cash == _CAP + Decimal("100")

    def test_loss_reduces_cash(self):
        dal = _dal()
        dal.positions.add(_closed_pos(entry="10", exit="8", qty=100))  # -200
        state, *_ = rebuild_portfolio_state(dal, _CAP)
        assert state.snapshot({}).cash == _CAP - Decimal("200")


# --------------------------------------------------------------------------- #
# §8 DuplicateOrderProtection rebuild
# --------------------------------------------------------------------------- #

class TestDuplicateProtectionRebuild:
    def test_in_flight_orders_registered(self):
        dal = _dal()
        o_new = _order(status=OrderStatus.NEW)
        o_sent = _order(status=OrderStatus.SENT)
        dal.orders.add(o_new)
        dal.orders.add(o_sent)
        dop, count, anomalies = rebuild_duplicate_protection(dal)
        assert count == 2 and anomalies == []
        assert dop.is_duplicate(o_new) is True
        assert dop.is_duplicate(o_sent) is True

    def test_terminal_orders_not_registered(self):
        dal = _dal()
        o_filled = _order(status=OrderStatus.FILLED)
        dal.orders.add(o_filled)
        dop, count, _ = rebuild_duplicate_protection(dal)
        assert count == 0
        assert dop.is_duplicate(o_filled) is False


# --------------------------------------------------------------------------- #
# §9 RiskState builder (supplies D4 inputs; no rule change)
# --------------------------------------------------------------------------- #

class TestRiskStateBuilder:
    def test_open_positions_and_kill_switch(self):
        dal = _dal()
        dal.positions.add(_open_pos())
        ks = KillSwitchLevelCache(dal)
        ks.record(level=2)
        builder = RiskStateBuilder(dal, ks)
        state = builder.build()
        assert state.open_positions == 1
        assert state.kill_switch_level == KillSwitchLevel.L2

    def test_trades_today_uses_ny_session(self):
        dal = _dal()
        # order created "now" counts for the current NY session day
        dal.orders.add(_order(status=OrderStatus.NEW, created_at=datetime.now(_UTC)))
        ks = KillSwitchLevelCache(dal)
        builder = RiskStateBuilder(dal, ks, clock=lambda: datetime.now(_UTC))
        assert builder.build().trades_today == 1

    def test_consecutive_losses_trailing(self):
        dal = _dal()
        # ordered by closed_at: win, loss, loss -> trailing streak = 2
        dal.positions.add(_closed_pos(entry="10", exit="12", qty=100, closed=_ts(hours=-3)))
        dal.positions.add(_closed_pos(entry="10", exit="9", qty=100, closed=_ts(hours=-2)))
        dal.positions.add(_closed_pos(entry="10", exit="8", qty=100, closed=_ts(hours=-1)))
        ks = KillSwitchLevelCache(dal)
        assert RiskStateBuilder(dal, ks).build().consecutive_losses == 2

    def test_builder_supplies_passed_in_figures(self):
        dal = _dal()
        ks = KillSwitchLevelCache(dal)
        s = RiskStateBuilder(dal, ks).build(
            daily_drawdown=Decimal("-0.02"), weekly_drawdown=Decimal("-0.04"),
            monthly_pause_active=True,
        )
        assert s.daily_drawdown == Decimal("-0.02")
        assert s.weekly_drawdown == Decimal("-0.04")
        assert s.monthly_pause_active is True


# --------------------------------------------------------------------------- #
# D5 ratified: recovery inconsistency -> Alert + DLQ + Continue
# --------------------------------------------------------------------------- #

class TestRecoveryInconsistency:
    def test_duplicate_open_position_recorded_and_continues(self):
        dal = _dal()
        from src.operations.alerting import AlertManager
        from src.operations.dlq import DeadLetterQueue
        # same id twice in OPEN -> second open_position raises in registry
        p = _open_pos()
        dup = Position(
            id=p.id, instrument_id=p.instrument_id, engine=p.engine,
            direction=p.direction, status=PositionStatus.OPEN, quantity=p.quantity,
            opened_at=p.opened_at, entry_price=p.entry_price,
        )
        # store both under list() by using two adds with different ids in store but
        # same business id is impossible in dict; instead simulate via monkeypatch:
        dal.positions.add(p)
        alerts = AlertManager(dal, dispatchers=[])
        dlq = DeadLetterQueue(dal)
        # craft a list returning a duplicate to force the anomaly path
        orig = dal.positions.list
        dal.positions.list = lambda **f: (
            [p, dup] if f.get("status") == PositionStatus.OPEN else orig(**f)
        )
        state, open_n, closed_n, anomalies = rebuild_portfolio_state(
            dal, _CAP, dlq=dlq, alert_manager=alerts
        )
        assert open_n == 1                      # first added, continued
        assert len(anomalies) == 1             # second flagged
        assert dlq.depth() == 1                 # dead-lettered
        assert dal.system_events.count(
            event_type=SystemEventType.WORKER_FAILURE
        ) >= 1


# --------------------------------------------------------------------------- #
# catalog readers (read-only; A2)
# --------------------------------------------------------------------------- #

class _CatPool:
    """Fake pool returning canned pg_catalog rows; read-only by construction."""
    def __init__(self, existing_names=(), children=()):
        self._existing = set(existing_names)
        self._children = list(children)
    def connection(self):
        return self
    def __enter__(self): return self
    def __exit__(self, *a): return False
    def cursor(self):
        return _CatCursor(self._existing, self._children)


class _CatCursor:
    def __init__(self, existing, children):
        self._existing = existing
        self._children = children
        self._mode = None
    def __enter__(self): return self
    def __exit__(self, *a): return False
    def execute(self, sql, params=None):
        self._mode = "exists" if "relname = %s" in sql else "list"
        self._params = params
    def fetchone(self):
        name = self._params[0]
        return (1,) if name in self._existing else None
    def fetchall(self):
        return [(c,) for c in self._children]


class TestCatalogReaders:
    def test_partition_exists_true_false(self):
        pool = _CatPool(existing_names={"orders_p202606"})
        exists = make_partition_exists(pool)
        assert exists("orders", "202606") is True
        assert exists("orders", "202607") is False

    def test_list_partitions_parses_names(self):
        pool = _CatPool(children=["orders_p202606", "signals_p202605", "junk"])
        parts = make_list_partitions(pool)()
        assert {"table": "orders", "yyyymm": "202606"} in parts
        assert {"table": "signals", "yyyymm": "202605"} in parts
        assert all("junk" != p.get("table") for p in parts)


# --------------------------------------------------------------------------- #
# bootstrap / Application lifecycle
# --------------------------------------------------------------------------- #

class TestBuildApplication:
    def test_build_returns_not_started_application(self):
        dal = _dal()
        app = build_application(dal, starting_capital=_CAP)
        assert isinstance(app, Application)
        assert app._started is False
        # ServiceStarted emitted during compose
        assert dal.system_events.count(
            event_type=SystemEventType.SERVICE_STARTED
        ) >= 1

    def test_recovery_summary_populated(self):
        dal = _dal()
        dal.positions.add(_closed_pos())
        dal.positions.add(_open_pos())
        dal.orders.add(_order(status=OrderStatus.SENT))
        app = build_application(dal, starting_capital=_CAP)
        assert app.recovery.open_positions == 1
        assert app.recovery.closed_positions == 1
        assert app.recovery.in_flight_orders == 1

    def test_engines_wired(self):
        dal = _dal()
        app = build_application(dal, starting_capital=_CAP)
        assert app.selection_engine is not None
        assert app.risk_engine is not None
        assert app.execution_engine is not None
        # rebuilt duplicate protection wired into the engine
        assert app.execution_engine.duplicates is app.duplicate_protection

    def test_broker_is_mock(self):
        dal = _dal()
        app = build_application(dal, starting_capital=_CAP)
        assert isinstance(app.broker, MockBrokerSyncContract)
        assert app.broker.is_connected() is True

    def test_explicit_start_and_shutdown(self):
        dal = _dal()
        app = build_application(dal, starting_capital=_CAP)
        assert app._started is False
        app.start(tick_sec=0.05)
        assert app._started is True
        app.shutdown()
        assert app._started is False
        assert dal.system_events.count(
            event_type=SystemEventType.SERVICE_STOPPED
        ) >= 1

    def test_scheduler_workers_registered_without_pool(self):
        dal = _dal()
        app = build_application(dal, starting_capital=_CAP)
        # without a pool, only HealthPoller + DLQMonitor are registered
        names = {w.name for w in app.scheduler.workers}
        assert "health_poller" in names
        assert "dlq_monitor" in names
        assert "partition_detector" not in names  # needs pool
