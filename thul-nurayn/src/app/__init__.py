"""THUL-NURAYN v1 — B9 Integration & Recovery package.

Composition root + read-only recovery glue. Wires the approved phases
(D1–D6 domain, B7 persistence, B8 operations) into one runnable application and
rebuilds transient in-memory state from PostgreSQL on startup/restart.

B9 adds NO domain logic: PostgreSQL is the sole source of truth, Redis is
non-authoritative, Portfolio ⟂ Risk ⟂ Execution is preserved, the broker
boundary is a mock only, and no strategy/risk/execution/sizing rule changes.

Exports:
  Application / bootstrap / build_application — composition + explicit start().
  RiskStateBuilder + rebuild_* + warm_redis_caches — recovery flows.
  MockBrokerSyncContract — in-memory broker for E2E (no network).
  make_partition_exists / make_list_partitions — read-only pg_catalog readers.
"""

from .bootstrap import Application, bootstrap, build_application
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

__all__ = [
    "Application",
    "bootstrap",
    "build_application",
    "MockBrokerSyncContract",
    "make_partition_exists",
    "make_list_partitions",
    "RecoveryResult",
    "RiskStateBuilder",
    "rebuild_kill_switch",
    "rebuild_portfolio_state",
    "rebuild_duplicate_protection",
    "warm_redis_caches",
]
