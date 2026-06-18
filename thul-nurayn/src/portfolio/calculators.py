"""THUL-NURAYN v1 — D6 Portfolio calculators.

PnLCalculator     — realized (Long/Short) and unrealized (open + marks).
EquityTracker     — equity, HWM, drawdown (D4-aligned convention: ≤ 0, = 0 at HWM).
StatisticsCalculator — D/W/M PeriodStats within a date window.

All Decimal; deterministic; no I/O. Missing marks excluded (fail-safe §13).
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from src.enums import Direction
from src.models import Position

from .models import PeriodStats

if TYPE_CHECKING:
    pass


class PnLCalculator:
    """Stateless realized and unrealized PnL computations."""

    @staticmethod
    def realized_for_position(position: Position) -> Decimal:
        """Realized PnL for one closed position.

        Long:  (exit − entry) × qty
        Short: (entry − exit) × qty
        Returns Decimal("0") if either price is missing.
        """
        if position.entry_price is None or position.exit_price is None:
            return Decimal("0")
        qty = Decimal(position.quantity)
        if position.direction == Direction.LONG:
            return (position.exit_price - position.entry_price) * qty
        return (position.entry_price - position.exit_price) * qty

    @staticmethod
    def realized(closed: list[Position]) -> Decimal:
        """Sum of realized PnL over all closed positions."""
        return sum(
            (PnLCalculator.realized_for_position(p) for p in closed),
            Decimal("0"),
        )

    @staticmethod
    def unrealized(
        open_positions: list[Position],
        marks: dict[UUID, Decimal],
    ) -> Decimal:
        """Mark-to-market PnL for open positions.

        Positions without a mark or without entry_price are excluded (§13 fail-safe).
        Long:  (mark − entry) × qty
        Short: (entry − mark) × qty
        """
        total = Decimal("0")
        for p in open_positions:
            mark = marks.get(p.instrument_id)
            if mark is None or p.entry_price is None:
                continue
            qty = Decimal(p.quantity)
            if p.direction == Direction.LONG:
                total += (mark - p.entry_price) * qty
            else:
                total += (p.entry_price - mark) * qty
        return total


class EquityTracker:
    """Maintains high-water mark and computes drawdown.

    Drawdown convention (D4-aligned, B6_ARCHITECTURE §7):
      drawdown = (equity − HWM) / HWM  ≤ 0;  = 0 when equity == HWM.
    """

    def __init__(self, starting_capital: Decimal) -> None:
        self._high_water_mark = starting_capital

    def update(self, equity: Decimal) -> None:
        """Raise HWM if equity surpasses current HWM."""
        if equity > self._high_water_mark:
            self._high_water_mark = equity

    @property
    def high_water_mark(self) -> Decimal:
        return self._high_water_mark

    def drawdown(self, equity: Decimal) -> Decimal:
        """(equity − HWM) / HWM, capped at 0 (never positive)."""
        dd = (equity - self._high_water_mark) / self._high_water_mark
        return min(dd, Decimal("0"))


class StatisticsCalculator:
    """Stateless D/W/M statistics computation."""

    @staticmethod
    def stats(
        closed: list[Position],
        period_type: str,
        start: datetime,
        end: datetime,
    ) -> PeriodStats:
        """Compute PeriodStats for positions closed within [start, end].

        A trade is a win when realized PnL > 0; otherwise a loss (includes 0).
        win_rate = wins / trades; 0 when no trades in the window.
        """
        in_period = [
            p for p in closed
            if p.closed_at is not None and start <= p.closed_at <= end
        ]
        total_pnl = Decimal("0")
        wins = 0
        losses = 0
        for p in in_period:
            pnl = PnLCalculator.realized_for_position(p)
            total_pnl += pnl
            if pnl > Decimal("0"):
                wins += 1
            else:
                losses += 1
        trades = wins + losses
        win_rate = (
            Decimal(wins) / Decimal(trades) if trades > 0 else Decimal("0")
        )
        return PeriodStats(
            period_type=period_type,
            period_start=start,
            period_end=end,
            trades=trades,
            wins=wins,
            losses=losses,
            realized_pnl=total_pnl,
            win_rate=win_rate,
        )


__all__ = ["PnLCalculator", "EquityTracker", "StatisticsCalculator"]
