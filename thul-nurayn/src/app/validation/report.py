"""THUL-NURAYN v1 — D14 validation reporting.

Read-only reporting layer (D14_PAPER_VALIDATION_ARCHITECTURE.md §5). Period
reports (daily/weekly/monthly) reuse the D6 `StatisticsCalculator` and persist
core stats into the EXISTING `performance_records` table (no schema change). The
cumulative report is the read-only `ValidationReport` (metrics module).

No recommendation engine, no auto-tuning (D14A — out of scope).
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from src.enums import PositionStatus
from src.models import PerformanceRecord
from src.portfolio import StatisticsCalculator

from .metrics import ValidationReport, compute_validation_metrics


class ValidationReporter:
    """Generates period + cumulative validation reports (read-only analytics)."""

    def __init__(self, dal, starting_capital: Decimal) -> None:
        self._dal = dal
        self._starting_capital = starting_capital

    def period_report(
        self,
        period_type: str,           # 'daily' | 'weekly' | 'monthly'
        start: datetime,
        end: datetime,
        *,
        persist: bool = True,
        created_at: datetime | None = None,
    ) -> PerformanceRecord:
        """Compute a period's core stats (D6) and (optionally) persist a row.

        Reuses D6 StatisticsCalculator; writes into the existing performance_records
        table (period_type matches its CHECK constraint). No new table/enum.
        """
        closed = self._dal.positions.list(status=PositionStatus.CLOSED)
        stats = StatisticsCalculator.stats(closed, period_type, start, end)
        record = PerformanceRecord(
            id=uuid4(),
            period_type=stats.period_type,
            period_start=stats.period_start,
            period_end=stats.period_end,
            trades=stats.trades,
            wins=stats.wins,
            losses=stats.losses,
            realized_pnl=stats.realized_pnl,
            win_rate=stats.win_rate,
            created_at=created_at or end,
        )
        if persist:
            self._dal.performance_records.add(record)
        return record

    def daily_report(self, start, end, **kw) -> PerformanceRecord:
        return self.period_report("daily", start, end, **kw)

    def weekly_report(self, start, end, **kw) -> PerformanceRecord:
        return self.period_report("weekly", start, end, **kw)

    def monthly_report(self, start, end, **kw) -> PerformanceRecord:
        return self.period_report("monthly", start, end, **kw)

    def cumulative_report(self, *, now: datetime | None = None) -> ValidationReport:
        """Full read-only validation measurement (no persistence)."""
        return compute_validation_metrics(
            self._dal, self._starting_capital, now=now
        )


__all__ = ["ValidationReporter"]
