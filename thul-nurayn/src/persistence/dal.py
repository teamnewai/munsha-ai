"""THUL-NURAYN v1 — B7 PostgreSQL DataAccessLayer.

PostgresDataAccessLayer is a subclass of DataAccessLayer that wires all 19
repositories to PostgreSQL via PostgresRepository / PostgresBridgeRepository.

Key design decisions (B7_ARCHITECTURE_SUMMARY §3):
  * super().__init__() is NOT called — avoids creating 19 InMemoryRepository
    instances.  All 19+2 repo attributes are set directly here.
  * All structural lookups (fills_for_order, score_for_signal, etc.) are
    inherited unchanged from DataAccessLayer; no override needed.
  * transaction() is completely overridden: uses BEGIN/COMMIT/ROLLBACK via
    ConnectionPool.transaction().  _snapshot()/_restore() on the repos are
    no-ops; DB atomicity is the mechanism.
  * The _repositories dict is reconstructed so the inherited `repositories`
    property continues to work.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from src.data_access.dal import DataAccessLayer
from src.models import (
    AuditLog, EarningsEvent, Fill, Instrument, MarketSnapshot, NewsEvent,
    Order, PerformanceRecord, Position, RiskCheck, RiskSnapshot, ScannerResult,
    Score, Sector, Signal, SignalEarnings, SignalNews, SystemEvent, User,
)

from .repository import PostgresBridgeRepository, PostgresRepository


class PostgresDataAccessLayer(DataAccessLayer):
    """Production DataAccessLayer backed by PostgreSQL.

    Drop-in replacement for DataAccessLayer (which uses InMemoryRepository).
    All callers interact only with the DataAccessLayer interface — no callers
    need changing.
    """

    def __init__(self, pool: object) -> None:
        # Intentionally do NOT call super().__init__().
        # super().__init__() would construct 19 InMemoryRepository instances
        # that are immediately discarded.  We set all attributes directly.

        # 17 entity repositories
        self.sectors = PostgresRepository(Sector, pool, "sectors")
        self.users = PostgresRepository(User, pool, "users")
        self.instruments = PostgresRepository(Instrument, pool, "instruments")
        self.market_snapshots = PostgresRepository(
            MarketSnapshot, pool, "market_snapshots"
        )
        self.scanner_results = PostgresRepository(
            ScannerResult, pool, "scanner_results"
        )
        self.signals = PostgresRepository(Signal, pool, "signals")
        self.scores = PostgresRepository(Score, pool, "scores")
        self.risk_checks = PostgresRepository(RiskCheck, pool, "risk_checks")
        self.orders = PostgresRepository(Order, pool, "orders")
        self.fills = PostgresRepository(Fill, pool, "fills")
        self.positions = PostgresRepository(Position, pool, "positions")
        self.risk_snapshots = PostgresRepository(
            RiskSnapshot, pool, "risk_snapshots"
        )
        self.news_events = PostgresRepository(NewsEvent, pool, "news_events")
        self.earnings_events = PostgresRepository(
            EarningsEvent, pool, "earnings_events"
        )
        self.performance_records = PostgresRepository(
            PerformanceRecord, pool, "performance_records"
        )
        self.audit_logs = PostgresRepository(
            AuditLog, pool, "audit_logs", append_only=True
        )
        self.system_events = PostgresRepository(
            SystemEvent, pool, "system_events", append_only=True
        )

        # 2 bridge repositories
        self.signal_news = PostgresBridgeRepository(
            SignalNews, pool, "signal_news", ("signal_id", "news_event_id")
        )
        self.signal_earnings = PostgresBridgeRepository(
            SignalEarnings, pool, "signal_earnings",
            ("signal_id", "earnings_event_id"),
        )

        # Rebuild _repositories dict (required by the inherited `repositories` property)
        self._repositories = {
            "sectors": self.sectors,
            "users": self.users,
            "instruments": self.instruments,
            "market_snapshots": self.market_snapshots,
            "scanner_results": self.scanner_results,
            "signals": self.signals,
            "scores": self.scores,
            "risk_checks": self.risk_checks,
            "orders": self.orders,
            "fills": self.fills,
            "positions": self.positions,
            "risk_snapshots": self.risk_snapshots,
            "news_events": self.news_events,
            "earnings_events": self.earnings_events,
            "performance_records": self.performance_records,
            "audit_logs": self.audit_logs,
            "system_events": self.system_events,
            "signal_news": self.signal_news,
            "signal_earnings": self.signal_earnings,
        }

        self._pool = pool

    # -- transaction boundary (overrides DataAccessLayer.transaction()) ----- #

    @contextmanager
    def transaction(self) -> Iterator["PostgresDataAccessLayer"]:
        """Real BEGIN/COMMIT/ROLLBACK transaction.

        All repository operations issued within this context block share a
        single PostgreSQL connection and run inside one transaction.  On
        success the transaction is committed; on any exception it is rolled
        back and the exception re-raises.

        The external interface (`with dal.transaction() as dal:`) is identical
        to DataAccessLayer.transaction().
        """
        with self._pool.transaction():
            yield self


__all__ = ["PostgresDataAccessLayer"]
