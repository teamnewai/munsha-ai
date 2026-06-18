"""THUL-NURAYN v1 — D6 Portfolio transient value objects.

All four types are transient (not persisted entities):
  AccountState     — computed account/cash model
  PeriodStats      — D/W/M computed stats (data may be written to performance_records)
  PortfolioSnapshot — immutable point-in-time read model

No new enums, entities, or tables. Precedent: approved B5 execution DTOs.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal


@dataclass(frozen=True)
class AccountState:
    """Computed account value model — no accounts table (B6_ARCHITECTURE §5)."""

    starting_capital: Decimal
    cash: Decimal  # starting_capital + cumulative realized PnL


@dataclass(frozen=True)
class PeriodStats:
    """Computed Daily/Weekly/Monthly statistics.

    The object is transient; its data may be persisted to the existing
    performance_records table via PortfolioState.persist_stats.
    """

    period_type: str   # 'daily' | 'weekly' | 'monthly'
    period_start: datetime
    period_end: datetime
    trades: int
    wins: int
    losses: int
    realized_pnl: Decimal
    win_rate: Decimal   # wins / trades; 0 when no trades


@dataclass(frozen=True)
class PortfolioSnapshot:
    """Immutable point-in-time read model produced by PortfolioState.snapshot().

    Consumed by D4 risk loop (drawdown/exposure/counts), D8 monitoring, D9 UI.
    All Decimal fields; deterministic for fixed inputs.
    """

    # Account
    starting_capital: Decimal
    cash: Decimal

    # PnL
    realized_pnl: Decimal
    unrealized_pnl: Decimal
    equity: Decimal

    # Risk figures (D4-aligned drawdown convention ≤ 0; = 0 at HWM)
    high_water_mark: Decimal
    drawdown: Decimal

    # Position counts (D4 MaxOpen gate consumes open_positions)
    open_positions: int
    core_open: int
    turbo_open: int

    # Per-engine exposure and 70/30 allocation monitoring (not enforced here)
    core_exposure: Decimal
    turbo_exposure: Decimal
    core_allocation: Decimal    # core_exposure / starting_capital
    turbo_allocation: Decimal   # turbo_exposure / starting_capital

    captured_at: datetime


__all__ = ["AccountState", "PeriodStats", "PortfolioSnapshot"]
