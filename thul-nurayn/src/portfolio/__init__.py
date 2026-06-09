"""THUL-NURAYN v1 — D6 Portfolio & State package.

Transient value objects and computation only. No new persisted entities, tables,
enums, or schema changes. Reuses D1 entities/enums and D2 repositories.

Public API:
  PortfolioState       — main aggregate; open/close positions; produce snapshots.
  PortfolioSnapshot    — immutable point-in-time read model.
  AccountState         — computed account/cash value model.
  PeriodStats          — D/W/M statistics value object.
  PnLCalculator        — realized (Long/Short) and unrealized PnL.
  EquityTracker        — HWM and drawdown (D4-aligned ≤ 0 convention).
  StatisticsCalculator — period statistics.
  OpenPositionsRegistry / ClosedPositionsRegistry — position registries.
  PortfolioError / InvalidCapital / PositionStateError — error hierarchy.
"""

from .calculators import EquityTracker, PnLCalculator, StatisticsCalculator
from .errors import InvalidCapital, PortfolioError, PositionStateError
from .models import AccountState, PeriodStats, PortfolioSnapshot
from .registry import ClosedPositionsRegistry, OpenPositionsRegistry
from .state import PortfolioState

__all__ = [
    "PortfolioState",
    "PortfolioSnapshot",
    "AccountState",
    "PeriodStats",
    "PnLCalculator",
    "EquityTracker",
    "StatisticsCalculator",
    "OpenPositionsRegistry",
    "ClosedPositionsRegistry",
    "PortfolioError",
    "InvalidCapital",
    "PositionStateError",
]
