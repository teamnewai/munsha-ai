"""THUL-NURAYN v1 — B8 Operations & Monitoring tests.

All tests are always-run: the operations layer talks to the D2 DataAccessLayer
interface, so the in-memory DataAccessLayer (B2) is a complete test backend for
system_events emission, DLQ, alerting, kill-switch caching, metrics, scheduler,
and workers. Health-probe tests use lightweight fakes for the pool/Redis client
(no real PostgreSQL/Redis required).

No existing test file is modified; B1–B7 suites are untouched.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest

from src.config import OperationsConfig
from src.data_access.dal import DataAccessLayer
from src.enums import (
    Direction,
    EngineType,
    OrderStatus,
    PositionStatus,
    SeverityLevel,
    SystemEventType,
)
from src.logging import redact
from src.models import Order, Position
from src.operations.alerting import AlertDispatcher, AlertManager, LogSinkDispatcher
from src.operations.dlq import DeadLetterQueue
from src.operations.events import emit_system_event
from src.operations.health import (
    DEGRADED,
    HEALTHY,
    UNAVAILABLE,
    ComponentHealth,
    HealthMonitor,
)
from src.operations.killswitch import KillSwitchLevelCache
from src.operations.metrics import MetricsCollector
from src.operations.scheduler import Scheduler, Worker
from src.operations.state import PAUSED, RUNNING, SHUTDOWN, operational_state
from src.operations.workers import (
    DLQMonitor,
    HealthPoller,
    HeartbeatEmitter,
    MissingPartitionDetector,
    RetentionTierer,
    _next_month_yyyymm,
)

_UTC = timezone.utc


def _ts() -> datetime:
    return datetime.now(_UTC)


def _dal() -> DataAccessLayer:
    return DataAccessLayer()


# --------------------------------------------------------------------------- #
# Fakes for health probes
# --------------------------------------------------------------------------- #

class _FakeCursor:
    def __enter__(self):
        return self
    def __exit__(self, *a):
        return False
    def execute(self, *a):
        return None
    def fetchone(self):
        return (1,)


class _FakeConn:
    def __enter__(self):
        return self
    def __exit__(self, *a):
        return False
    def cursor(self):
        return _FakeCursor()


class _OkPool:
    def connection(self):
        return _FakeConn()


class _BadPool:
    def connection(self):
        raise RuntimeError("db down")


class _Redis:
    def __init__(self, available=True):
        self.available = available
        self._store = {}
    def ping(self):
        if not self.available:
            return False
        return True
    def get(self, key):
        return self._store.get(key) if self.available else None
    def set(self, key, value, ex=None):
        if not self.available:
            return None
        self._store[key] = str(value)
        return True
    def delete(self, key):
        if not self.available:
            return None
        return self._store.pop(key, None)


# --------------------------------------------------------------------------- #
# events
# --------------------------------------------------------------------------- #

class TestSystemEventEmission:
    def test_emit_appends_row(self):
        dal = _dal()
        ev = emit_system_event(
            dal, SystemEventType.SERVICE_STARTED, SeverityLevel.WARNING,
            {"k": "v"},
        )
        assert ev.event_type is SystemEventType.SERVICE_STARTED
        rows = dal.system_events.list(event_type=SystemEventType.SERVICE_STARTED)
        assert len(rows) == 1
        assert rows[0].detail == {"k": "v"}

    def test_system_events_is_append_only(self):
        dal = _dal()
        ev = emit_system_event(
            dal, SystemEventType.SERVICE_STARTED, SeverityLevel.WARNING, None
        )
        from src.data_access.errors import ImmutableViolation
        with pytest.raises(ImmutableViolation):
            dal.system_events.update(ev)


# --------------------------------------------------------------------------- #
# alerting
# --------------------------------------------------------------------------- #

class TestAlertManager:
    def test_alert_records_durable_row_first(self):
        dal = _dal()
        mgr = AlertManager(dal, dispatchers=[])
        mgr.alert(
            SystemEventType.REDIS_EVENT, SeverityLevel.WARNING, {"x": 1}
        )
        rows = dal.system_events.list(event_type=SystemEventType.REDIS_EVENT)
        assert len(rows) == 1
        assert rows[0].severity is SeverityLevel.WARNING

    def test_dispatcher_failure_is_non_fatal(self):
        dal = _dal()

        class _Boom(AlertDispatcher):
            def dispatch(self, event, severity):
                raise RuntimeError("transport down")

        mgr = AlertManager(dal, dispatchers=[_Boom()])
        # Must not raise; durable record still written.
        ev = mgr.alert(SystemEventType.WORKER_FAILURE, SeverityLevel.CRITICAL, {})
        assert ev is not None
        assert dal.system_events.count(event_type=SystemEventType.WORKER_FAILURE) == 1

    def test_log_sink_dispatcher_returns_true(self):
        dal = _dal()
        d = LogSinkDispatcher()
        ev = emit_system_event(
            dal, SystemEventType.REDIS_EVENT, SeverityLevel.WARNING, {}
        )
        assert d.dispatch(ev, SeverityLevel.WARNING) is True


# --------------------------------------------------------------------------- #
# DLQ
# --------------------------------------------------------------------------- #

class TestDeadLetterQueue:
    def test_dead_letter_creates_worker_failure(self):
        dal = _dal()
        dlq = DeadLetterQueue(dal)
        ev = dlq.dead_letter("order", {"id": "1"}, "boom", {"order_id": "1"})
        assert ev.event_type is SystemEventType.WORKER_FAILURE
        assert dlq.depth() == 1
        assert dlq.list_unresolved()[0].detail["item_type"] == "order"

    def test_resolve_removes_from_unresolved(self):
        dal = _dal()
        dlq = DeadLetterQueue(dal)
        ev = dlq.dead_letter("order", {"id": "1"}, "boom")
        assert dlq.depth() == 1
        dlq.resolve(ev.id, resolved_by="operator", note="fixed")
        assert dlq.depth() == 0
        assert dlq.list_unresolved() == []

    def test_resolution_is_append_only_not_mutation(self):
        dal = _dal()
        dlq = DeadLetterQueue(dal)
        ev = dlq.dead_letter("order", {"id": "1"}, "boom")
        dlq.resolve(ev.id, resolved_by="operator")
        # both the dlq row and the resolution row exist (append-only)
        assert dal.system_events.count(
            event_type=SystemEventType.WORKER_FAILURE
        ) == 2

    def test_multiple_items_depth(self):
        dal = _dal()
        dlq = DeadLetterQueue(dal)
        a = dlq.dead_letter("a", {}, "r1")
        dlq.dead_letter("b", {}, "r2")
        assert dlq.depth() == 2
        dlq.resolve(a.id, resolved_by="op")
        assert dlq.depth() == 1

    def test_redis_index_rebuild(self):
        dal = _dal()
        redis = _Redis(available=True)
        dlq = DeadLetterQueue(dal, redis_client=redis)
        dlq.dead_letter("a", {}, "r1")
        assert dlq.rebuild_index() == 1


# --------------------------------------------------------------------------- #
# kill-switch level cache
# --------------------------------------------------------------------------- #

class TestKillSwitchLevelCache:
    def test_record_appends_kill_switch_event(self):
        dal = _dal()
        ks = KillSwitchLevelCache(dal)
        ks.record(level=4, severity=SeverityLevel.EMERGENCY)
        rows = dal.system_events.list(
            event_type=SystemEventType.KILL_SWITCH_ACTIVATED
        )
        assert len(rows) == 1
        assert rows[0].detail["level"] == 4

    def test_rebuild_returns_latest_level(self):
        dal = _dal()
        ks = KillSwitchLevelCache(dal)
        ks.record(level=2)
        ks.record(level=3)
        assert ks.rebuild() == 3

    def test_rebuild_zero_when_no_rows(self):
        dal = _dal()
        ks = KillSwitchLevelCache(dal)
        assert ks.rebuild() == 0

    def test_current_level_uses_redis_cache(self):
        dal = _dal()
        redis = _Redis(available=True)
        ks = KillSwitchLevelCache(dal, redis_client=redis)
        ks.record(level=3)
        # Even if DB were empty, the cache returns 3; confirm cache hit path.
        assert ks.current_level() == 3

    def test_current_level_rebuilds_when_no_cache(self):
        dal = _dal()
        redis = _Redis(available=False)  # degraded -> no cache
        ks = KillSwitchLevelCache(dal, redis_client=redis)
        ks.record(level=2)
        assert ks.current_level() == 2

    def test_does_not_import_risk_killswitch_enum(self):
        # No code dependency on D4 (§12): the level is treated as data only.
        import src.operations.killswitch as mod
        src = open(mod.__file__).read()
        assert "from src.risk" not in src
        assert "import src.risk" not in src


# --------------------------------------------------------------------------- #
# health monitor
# --------------------------------------------------------------------------- #

class TestHealthMonitor:
    def test_healthy_when_pg_and_redis_up(self):
        hm = HealthMonitor(pool=_OkPool(), redis_client=_Redis(True))
        report = hm.check()
        assert report.ready is True
        assert report.status == HEALTHY

    def test_degraded_when_redis_down(self):
        hm = HealthMonitor(pool=_OkPool(), redis_client=_Redis(False))
        report = hm.check()
        assert report.ready is True
        assert report.status == DEGRADED

    def test_not_ready_when_pg_down(self):
        hm = HealthMonitor(pool=_BadPool(), redis_client=_Redis(True))
        report = hm.check()
        assert report.ready is False
        assert report.status == UNAVAILABLE

    def test_transition_emits_single_event(self):
        dal = _dal()
        alerts = AlertManager(dal, dispatchers=[])
        redis = _Redis(True)
        hm = HealthMonitor(pool=_OkPool(), redis_client=redis, alert_manager=alerts)
        hm.check()  # baseline: redis up, no event
        assert dal.system_events.count(event_type=SystemEventType.REDIS_EVENT) == 0
        redis.available = False
        hm.check()  # transition up -> down: one event
        assert dal.system_events.count(event_type=SystemEventType.REDIS_EVENT) == 1
        hm.check()  # still down: no new event
        assert dal.system_events.count(event_type=SystemEventType.REDIS_EVENT) == 1


# --------------------------------------------------------------------------- #
# operational state model
# --------------------------------------------------------------------------- #

class TestOperationalStateModel:
    def _report(self, ready, status):
        return HealthMonitor.__new__(HealthMonitor) and __import__(
            "src.operations.health", fromlist=["HealthReport"]
        ).HealthReport(ready=ready, status=status, components=(), captured_at=_ts())

    def test_running(self):
        r = self._report(True, HEALTHY)
        assert operational_state(r, 0) == RUNNING

    def test_degraded(self):
        r = self._report(True, DEGRADED)
        assert operational_state(r, 0) == "DEGRADED"

    def test_paused_l2(self):
        r = self._report(True, HEALTHY)
        assert operational_state(r, 2) == PAUSED

    def test_shutdown_l4(self):
        r = self._report(True, HEALTHY)
        assert operational_state(r, 4) == SHUTDOWN

    def test_shutdown_when_not_ready(self):
        r = self._report(False, UNAVAILABLE)
        assert operational_state(r, 0) == SHUTDOWN


# --------------------------------------------------------------------------- #
# scheduler
# --------------------------------------------------------------------------- #

class TestScheduler:
    def test_run_all_once_invokes_workers(self):
        dal = _dal()
        sched = Scheduler(dal)
        calls = []

        class _W(Worker):
            name = "w1"
            interval = 1.0
            def run_once(self):
                calls.append(1)

        sched.register(_W())
        sched.run_all_once()
        assert calls == [1]

    def test_failure_isolated_and_recorded(self):
        dal = _dal()
        alerts = AlertManager(dal, dispatchers=[])
        sched = Scheduler(dal, alert_manager=alerts)

        class _Bad(Worker):
            name = "bad"
            interval = 1.0
            def run_once(self):
                raise ValueError("kaboom")

        class _Good(Worker):
            name = "good"
            interval = 1.0
            def run_once(self):
                self.ran = True

        good = _Good()
        sched.register(_Bad())
        sched.register(good)
        sched.run_all_once()  # must not raise
        assert getattr(good, "ran", False) is True
        # failure recorded as WorkerFailure
        assert dal.system_events.count(
            event_type=SystemEventType.WORKER_FAILURE
        ) == 1

    def test_failure_dead_lettered(self):
        dal = _dal()
        dlq = DeadLetterQueue(dal)
        sched = Scheduler(dal, dlq=dlq)

        class _Bad(Worker):
            name = "bad"
            interval = 1.0
            def run_once(self):
                raise RuntimeError("x")

        sched.register(_Bad())
        sched.run_all_once()
        assert dlq.depth() == 1

    def test_run_due_respects_interval(self):
        dal = _dal()
        sched = Scheduler(dal)
        calls = []

        class _W(Worker):
            name = "w"
            interval = 100.0
            def run_once(self):
                calls.append(1)

        sched.register(_W())
        sched.run_due(now=0.0)
        sched.run_due(now=50.0)   # within interval -> skip
        assert len(calls) == 1
        sched.run_due(now=200.0)  # elapsed -> run
        assert len(calls) == 2


# --------------------------------------------------------------------------- #
# workers
# --------------------------------------------------------------------------- #

class TestWorkers:
    def test_health_poller_runs_check(self):
        hm = HealthMonitor(pool=_OkPool(), redis_client=_Redis(True))
        w = HealthPoller(hm)
        w.run_once()
        assert w.last_report is not None and w.last_report.ready is True

    def test_dlq_monitor_warning_threshold(self):
        dal = _dal()
        dlq = DeadLetterQueue(dal)
        alerts = AlertManager(dal, dispatchers=[])
        cfg = OperationsConfig(dlq_depth_warning=1, dlq_depth_critical=10)
        dlq.dead_letter("a", {}, "r")
        DLQMonitor(dlq, alerts, cfg).run_once()
        # one dead-letter row + one warning alert row = 2 WorkerFailure rows
        rows = dal.system_events.list(event_type=SystemEventType.WORKER_FAILURE)
        assert any((r.detail or {}).get("kind") == "dlq_depth" for r in rows)

    def test_dlq_monitor_critical_threshold(self):
        dal = _dal()
        dlq = DeadLetterQueue(dal)
        alerts = AlertManager(dal, dispatchers=[])
        cfg = OperationsConfig(dlq_depth_warning=1, dlq_depth_critical=2)
        dlq.dead_letter("a", {}, "r")
        dlq.dead_letter("b", {}, "r")
        DLQMonitor(dlq, alerts, cfg).run_once()
        crit = [
            r for r in dal.system_events.list(
                event_type=SystemEventType.WORKER_FAILURE
            )
            if (r.detail or {}).get("threshold") == "critical"
        ]
        assert len(crit) == 1

    def test_missing_partition_detector_alerts(self):
        dal = _dal()
        alerts = AlertManager(dal, dispatchers=[])
        # exists() always False -> every table missing -> one alert
        det = MissingPartitionDetector(alerts, partition_exists=lambda t, m: False)
        det.run_once()
        alert_rows = [
            r for r in dal.system_events.list(
                event_type=SystemEventType.WORKER_FAILURE
            )
            if (r.detail or {}).get("kind") == "missing_partition"
        ]
        assert len(alert_rows) == 1
        assert set(alert_rows[0].detail["tables"]) == {
            "signals", "orders", "audit_logs",
            "system_events", "market_snapshots", "risk_snapshots",
        }

    def test_missing_partition_detector_silent_when_present(self):
        dal = _dal()
        alerts = AlertManager(dal, dispatchers=[])
        det = MissingPartitionDetector(alerts, partition_exists=lambda t, m: True)
        det.run_once()
        assert dal.system_events.count(
            event_type=SystemEventType.WORKER_FAILURE
        ) == 0

    def test_detector_does_not_provision(self):
        # A2: detector only reads exists(); it never calls a create function.
        import src.operations.workers as mod
        src = open(mod.__file__).read()
        assert "CREATE TABLE" not in src
        assert "PARTITION OF" not in src

    def test_retention_tierer_classifies(self):
        dal = _dal()
        cfg = OperationsConfig(retention_hot_months=3, retention_warm_months=12)
        now = datetime(2026, 6, 1, tzinfo=_UTC)
        parts = [
            {"table": "orders", "yyyymm": "202606"},  # age 0 -> Hot
            {"table": "orders", "yyyymm": "202601"},  # age 5 -> Warm
            {"table": "orders", "yyyymm": "202401"},  # age 29 -> Cold
        ]
        w = RetentionTierer(dal, cfg, list_partitions=lambda: parts, clock=lambda: now)
        w.run_once()
        assert w.last_classification["orders_p202606"] == "Hot"
        assert w.last_classification["orders_p202601"] == "Warm"
        assert w.last_classification["orders_p202401"] == "Cold"

    def test_heartbeat_emitter(self):
        dal = _dal()
        hb = HeartbeatEmitter(dal)
        hb.on_start()
        hb.on_stop()
        assert dal.system_events.count(
            event_type=SystemEventType.SERVICE_STARTED
        ) == 1
        assert dal.system_events.count(
            event_type=SystemEventType.SERVICE_STOPPED
        ) == 1

    def test_next_month_rollover(self):
        assert _next_month_yyyymm(datetime(2026, 12, 15, tzinfo=_UTC)) == "202701"
        assert _next_month_yyyymm(datetime(2026, 6, 15, tzinfo=_UTC)) == "202607"


# --------------------------------------------------------------------------- #
# metrics
# --------------------------------------------------------------------------- #

class TestMetricsCollector:
    def _open_position(self):
        return Position(
            id=uuid4(), instrument_id=uuid4(), engine=EngineType.CORE,
            direction=Direction.LONG, status=PositionStatus.OPEN, quantity=10,
            opened_at=_ts(), entry_price=Decimal("10"),
        )

    def _new_order(self):
        return Order(
            id=uuid4(), created_at=_ts(), instrument_id=uuid4(), user_id=uuid4(),
            engine=EngineType.CORE, direction=Direction.LONG,
            status=OrderStatus.NEW, quantity=10,
        )

    def test_collect_counts(self):
        dal = _dal()
        dal.positions.add(self._open_position())
        dal.orders.add(self._new_order())
        dlq = DeadLetterQueue(dal)
        dlq.dead_letter("x", {}, "r")
        mc = MetricsCollector(dal, dlq=dlq, redis_client=_Redis(True))
        m = mc.collect()
        assert m.open_positions == 1
        assert m.open_orders == 1
        assert m.dlq_depth == 1
        assert m.redis_available is True

    def test_collect_with_health(self):
        dal = _dal()
        hm = HealthMonitor(pool=_OkPool(), redis_client=_Redis(True))
        mc = MetricsCollector(dal, health_monitor=hm, redis_client=_Redis(True))
        m = mc.collect()
        assert m.postgres_healthy is True


# --------------------------------------------------------------------------- #
# config & logging
# --------------------------------------------------------------------------- #

class TestConfig:
    def test_defaults(self):
        cfg = OperationsConfig()
        assert cfg.dlq_depth_warning == 1
        assert cfg.dlq_depth_critical == 10

    def test_from_env_override(self, monkeypatch):
        monkeypatch.setenv("OPS_DLQ_DEPTH_CRITICAL", "99")
        cfg = OperationsConfig.from_env()
        assert cfg.dlq_depth_critical == 99


class TestStructuredLogging:
    def test_redacts_dsn_credentials(self):
        out = redact("connecting to postgresql://user:secretpw@host:5432/db")
        assert "secretpw" not in out
        assert "[REDACTED]" in out

    def test_redacts_kv_secret(self):
        out = redact("password=hunter2 other=ok")
        assert "hunter2" not in out
        assert "other=ok" in out
