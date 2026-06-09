"""THUL-NURAYN v1 — D2 DataAccessLayer.

Unified access point wiring 19 repositories (17 entity + 2 bridge), per
D2_DATA_ACCESS_REPORT §2/§3. Provides:
  * one repository per D1 entity
  * structural relationship lookups (pure data access — NO logic):
      Order→Fill→Position shape; Signal↔Score / Signal↔RiskCheck 1:1;
      Signal↔News / Signal↔Earnings bridges
  * an in-memory transaction boundary (snapshot/rollback)

No strategy, risk, or execution logic lives here — only storage/retrieval.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator, Optional
from uuid import UUID

from src.models import (
    AuditLog, EarningsEvent, Fill, Instrument, MarketSnapshot, NewsEvent,
    Order, PerformanceRecord, Position, RiskCheck, RiskSnapshot, ScannerResult,
    Score, Sector, Signal, SignalEarnings, SignalNews, SystemEvent, User,
)

from .repository import BridgeRepository, InMemoryRepository


class DataAccessLayer:
    """Aggregates the 19 repositories and exposes structural lookups."""

    def __init__(self) -> None:
        # 17 entity repositories
        self.sectors = InMemoryRepository(Sector, unique_fields=("name",))
        self.users = InMemoryRepository(User, unique_fields=("username",))
        self.instruments = InMemoryRepository(Instrument, unique_fields=("symbol",))
        self.market_snapshots = InMemoryRepository(MarketSnapshot)
        self.scanner_results = InMemoryRepository(ScannerResult)
        self.signals = InMemoryRepository(Signal)
        self.scores = InMemoryRepository(Score, unique_fields=("signal_id",))
        self.risk_checks = InMemoryRepository(RiskCheck, unique_fields=("signal_id",))
        self.orders = InMemoryRepository(Order)
        self.fills = InMemoryRepository(Fill)
        self.positions = InMemoryRepository(Position)
        self.risk_snapshots = InMemoryRepository(RiskSnapshot)
        self.news_events = InMemoryRepository(NewsEvent)
        self.earnings_events = InMemoryRepository(EarningsEvent)
        self.performance_records = InMemoryRepository(PerformanceRecord)
        self.audit_logs = InMemoryRepository(AuditLog, append_only=True)
        self.system_events = InMemoryRepository(SystemEvent, append_only=True)
        # 2 bridge repositories
        self.signal_news = BridgeRepository(SignalNews, ("signal_id", "news_event_id"))
        self.signal_earnings = BridgeRepository(
            SignalEarnings, ("signal_id", "earnings_event_id")
        )

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

    @property
    def repositories(self) -> dict:
        """Read-only view of all wired repositories (name -> repository)."""
        return dict(self._repositories)

    # -- structural relationship lookups (no business logic) --------------- #
    def fills_for_order(self, order_id: UUID) -> list[Fill]:
        """All fills belonging to one order (Order 1─* Fill)."""
        return self.fills.list(order_id=order_id)

    def fills_for_position(self, position_id: UUID) -> list[Fill]:
        """All fills attributed to one position (Fill *─1 Position)."""
        return self.fills.list(position_id=position_id)

    def orders_for_position(self, position_id: UUID) -> list[Order]:
        """All orders pointing at one position (Order *─1 Position)."""
        return self.orders.list(position_id=position_id)

    def score_for_signal(self, signal_id: UUID) -> Optional[Score]:
        """The score linked 1:1 to a signal, or None."""
        results = self.scores.list(signal_id=signal_id)
        return results[0] if results else None

    def risk_check_for_signal(self, signal_id: UUID) -> Optional[RiskCheck]:
        """The risk check linked 1:1 to a signal, or None."""
        results = self.risk_checks.list(signal_id=signal_id)
        return results[0] if results else None

    def news_for_signal(self, signal_id: UUID) -> list[SignalNews]:
        """Signal↔News bridge rows for a signal."""
        return self.signal_news.list(signal_id=signal_id)

    def earnings_for_signal(self, signal_id: UUID) -> list[SignalEarnings]:
        """Signal↔Earnings bridge rows for a signal."""
        return self.signal_earnings.list(signal_id=signal_id)

    # -- transaction boundary --------------------------------------------- #
    @contextmanager
    def transaction(self) -> Iterator["DataAccessLayer"]:
        """In-memory unit of work: commit on success, roll back on exception.

        Snapshots every repository's store on entry; on exception the stores
        are restored, then the exception re-raises. (The PostgresRepository
        backend in B7 will implement this against a real DB transaction.)
        """
        snapshots = {
            name: repo._snapshot() for name, repo in self._repositories.items()
        }
        try:
            yield self
        except Exception:
            for name, snap in snapshots.items():
                self._repositories[name]._restore(snap)
            raise


__all__ = ["DataAccessLayer"]
