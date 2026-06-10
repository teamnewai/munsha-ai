"""THUL-NURAYN v1 — B9 application bootstrap (composition root).

Assembles the object graph in dependency order and returns a composed, recovered,
**not-yet-started** `Application` (Owner Decision D6 — explicit start())
per B9_INTEGRATION_ARCHITECTURE §3, §11, §14.

B9 is wiring + read-only recovery only. It constructs existing components
(D3–D6 engines, B7 infra, B8 operations) and injects a single shared DAL; it
adds NO domain logic and modifies NO prior phase.

Two construction modes:
  * `bootstrap(...)` — production: builds ConnectionPool + PostgresDataAccessLayer
    + RedisClient from env (B7); health-gated (PostgreSQL mandatory).
  * `build_application(dal, pool=None, redis_client=None, ...)` — explicit
    injection (used by tests with the in-memory DAL; drop-in behind the D2 ABC).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional

from src.execution.engine import ExecutionEngine
from src.logging import configure_logging, get_logger
from src.operations.alerting import AlertManager
from src.operations.dlq import DeadLetterQueue
from src.operations.health import HealthMonitor
from src.operations.killswitch import KillSwitchLevelCache
from src.operations.metrics import MetricsCollector
from src.operations.scheduler import Scheduler
from src.operations.workers import (
    DLQMonitor,
    HealthPoller,
    HeartbeatEmitter,
    MissingPartitionDetector,
    RetentionTierer,
)
from src.risk.engine import RiskDecisionEngine
from src.selection.engine import SelectionEngine

from .broker_mock import MockBrokerSyncContract
from .catalog import make_list_partitions, make_partition_exists
from .recovery import (
    RecoveryResult,
    RiskStateBuilder,
    rebuild_duplicate_protection,
    rebuild_kill_switch,
    rebuild_portfolio_state,
    warm_redis_caches,
)


@dataclass
class Application:
    """Composed object graph. A plain wiring container — not persisted.

    Returned by bootstrap fully composed and recovered but NOT started; the
    scheduler loop begins only on `start()` (Owner Decision D6).
    """

    config: object
    dal: object
    pool: Optional[object]
    redis_client: Optional[object]
    # operations (B8)
    alert_manager: AlertManager
    dlq: DeadLetterQueue
    kill_switch_cache: KillSwitchLevelCache
    health_monitor: HealthMonitor
    metrics: MetricsCollector
    scheduler: Scheduler
    heartbeat: HeartbeatEmitter
    # domain engines (D3–D6) + recovered aggregates
    selection_engine: SelectionEngine
    risk_engine: RiskDecisionEngine
    execution_engine: ExecutionEngine
    portfolio_state: object
    duplicate_protection: object
    risk_state_builder: RiskStateBuilder
    broker: object
    recovery: RecoveryResult
    _started: bool = field(default=False)

    # -- explicit lifecycle (D6) ------------------------------------------- #
    def start(self, tick_sec: float = 1.0) -> "Application":
        """Start the scheduler loop. Idempotent. Begins background jobs only here."""
        if self._started:
            return self
        self.scheduler.start(tick_sec=tick_sec)
        self._started = True
        return self

    def shutdown(self) -> None:
        """Graceful shutdown (reverse of startup); idempotent; no data loss."""
        if self._started:
            self.scheduler.stop()
            self._started = False
        self.heartbeat.on_stop()
        if self.pool is not None:
            try:
                self.pool.close()
            except Exception:
                pass


def build_application(
    dal,
    *,
    starting_capital: Decimal,
    pool=None,
    redis_client=None,
    config=None,
    broker=None,
    clock=None,
) -> Application:
    """Compose + recover from an already-constructed DAL (explicit injection).

    Recovery order (Owner Decision D4):
      Kill-Switch -> Portfolio -> Duplicate Protection -> Risk State -> Warm Redis.
    Returns a NOT-yet-started Application (D6).
    """
    from src.config import OperationsConfig

    configure_logging()
    log = get_logger("thul.app")
    cfg = config or OperationsConfig.from_env()

    # -- operations (B8) --------------------------------------------------- #
    alert_manager = AlertManager(dal)
    dlq = DeadLetterQueue(dal, redis_client=redis_client)
    kill_switch_cache = KillSwitchLevelCache(
        dal, redis_client=redis_client, cache_key=cfg.kill_switch_cache_key
    )
    health_monitor = HealthMonitor(
        pool=pool, redis_client=redis_client, alert_manager=alert_manager
    )
    metrics = MetricsCollector(
        dal, health_monitor=health_monitor, dlq=dlq, redis_client=redis_client
    )
    heartbeat = HeartbeatEmitter(dal)

    # -- recovery (B9, read-only; ratified order D4) ----------------------- #
    ks_level = rebuild_kill_switch(kill_switch_cache)                      # 1
    portfolio_state, open_n, closed_n, a1 = rebuild_portfolio_state(       # 2
        dal, starting_capital, dlq=dlq, alert_manager=alert_manager
    )
    duplicate_protection, inflight_n, a2 = rebuild_duplicate_protection(   # 3
        dal, dlq=dlq, alert_manager=alert_manager
    )
    risk_state_builder = RiskStateBuilder(                                 # 4
        dal, kill_switch_cache, clock=clock
    )
    warm_redis_caches(kill_switch_cache, dlq, redis_client=redis_client)   # 5

    recovery = RecoveryResult(
        kill_switch_level=ks_level,
        open_positions=open_n,
        closed_positions=closed_n,
        in_flight_orders=inflight_n,
        anomalies=list(a1) + list(a2),
    )

    # -- domain engines (D3–D6); broker boundary = mock only (D3) ---------- #
    broker = broker or MockBrokerSyncContract()
    selection_engine = SelectionEngine()
    risk_engine = RiskDecisionEngine()
    execution_engine = ExecutionEngine(dal, broker_sync=broker)
    # Wire the recovered DuplicateOrderProtection into the engine so in-flight
    # fingerprints stay blocked after restart (§8). This is instance wiring, not
    # a D5 source change — the engine's public `duplicates` attribute is reused.
    execution_engine.duplicates = duplicate_protection

    # -- scheduler: register workers; DO NOT start (D6) -------------------- #
    scheduler = Scheduler(dal, alert_manager=alert_manager, dlq=dlq)
    scheduler.register(HealthPoller(health_monitor, interval=cfg.health_poll_interval_sec))
    scheduler.register(DLQMonitor(dlq, alert_manager, cfg, interval=cfg.dlq_monitor_interval_sec))
    if pool is not None:
        scheduler.register(
            MissingPartitionDetector(
                alert_manager, make_partition_exists(pool),
                interval=cfg.partition_check_interval_sec,
            )
        )
        scheduler.register(
            RetentionTierer(
                dal, cfg, make_list_partitions(pool),
                interval=cfg.retention_tier_interval_sec,
            )
        )
    heartbeat.on_start()

    log.info(
        "application composed ks_level=%s open=%s closed=%s in_flight=%s anomalies=%s",
        ks_level, open_n, closed_n, inflight_n, len(recovery.anomalies),
    )

    return Application(
        config=cfg,
        dal=dal,
        pool=pool,
        redis_client=redis_client,
        alert_manager=alert_manager,
        dlq=dlq,
        kill_switch_cache=kill_switch_cache,
        health_monitor=health_monitor,
        metrics=metrics,
        scheduler=scheduler,
        heartbeat=heartbeat,
        selection_engine=selection_engine,
        risk_engine=risk_engine,
        execution_engine=execution_engine,
        portfolio_state=portfolio_state,
        duplicate_protection=duplicate_protection,
        risk_state_builder=risk_state_builder,
        broker=broker,
        recovery=recovery,
    )


def bootstrap(*, starting_capital: Optional[Decimal] = None, clock=None) -> Application:
    """Production composition root (B7-backed).

    Steps (B9 §3): config/logging -> ConnectionPool + RedisClient -> PostgresDAL
    -> operations -> recovery -> engines -> register workers. Health-gated:
    `ConnectionPool` raises `PersistenceError` if PostgreSQL is unreachable.
    Returns a NOT-yet-started Application (D6).
    """
    import os

    from src.config import OperationsConfig
    from src.persistence.connection import ConnectionPool
    from src.persistence.dal import PostgresDataAccessLayer
    from src.redis import RedisClient

    configure_logging()
    cfg = OperationsConfig.from_env()

    if starting_capital is None:
        # Owner Decision D1 — starting capital from environment/configuration.
        raw = os.environ.get("STARTING_CAPITAL")
        if raw in (None, ""):
            raise ValueError("STARTING_CAPITAL is not set (Owner Decision D1)")
        starting_capital = Decimal(raw)

    pool = ConnectionPool()              # raises PersistenceError if PG unreachable
    redis_client = RedisClient()         # non-fatal/degraded
    dal = PostgresDataAccessLayer(pool)

    return build_application(
        dal,
        starting_capital=starting_capital,
        pool=pool,
        redis_client=redis_client,
        config=cfg,
        clock=clock,
    )


__all__ = ["Application", "bootstrap", "build_application"]
