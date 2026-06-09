"""THUL-NURAYN v1 — D6 PortfolioState aggregate.

Main entry point for B6. Composes AccountState, registries, EquityTracker, and
the calculators. Produces deterministic PortfolioSnapshot read models.

Constraints (B6_PORTFOLIO_ARCHITECTURE §2):
  - Computes state; does NOT decide risk or execute orders.
  - No state machine ownership (Open→Closed is D5's; B6 reflects only).
  - Marks are passed in; B6 never fetches prices.
  - Persists period statistics to existing performance_records via D2 (no new table).
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from src.enums import EngineType
from src.models import PerformanceRecord, Position

from .calculators import EquityTracker, PnLCalculator, StatisticsCalculator
from .errors import InvalidCapital
from .models import AccountState, PeriodStats, PortfolioSnapshot
from .registry import ClosedPositionsRegistry, OpenPositionsRegistry


class PortfolioState:
    """Mutable portfolio aggregate; produces immutable PortfolioSnapshot read models.

    Starting capital must be > 0 (fail-safe §13).
    """

    def __init__(self, starting_capital: Decimal) -> None:
        if starting_capital <= Decimal("0"):
            raise InvalidCapital(
                f"starting_capital must be > 0; got {starting_capital}"
            )
        self._account = AccountState(
            starting_capital=starting_capital,
            cash=starting_capital,
        )
        self._open = OpenPositionsRegistry()
        self._closed = ClosedPositionsRegistry()
        self._equity_tracker = EquityTracker(starting_capital)

    # -- position lifecycle reflection ------------------------------------- #

    def open_position(self, position: Position) -> None:
        """Reflect D5's Open event: add to open registry."""
        self._open.add(position)

    def close_position(self, position: Position) -> None:
        """Reflect D5's Close event: move to closed registry, update cash.

        Realized PnL is computed from the position's entry_price and exit_price.
        AccountState.cash is updated immediately; HWM/drawdown update at next snapshot().
        """
        self._open.remove(position.id)
        self._closed.add(position)
        pnl = PnLCalculator.realized_for_position(position)
        self._account = AccountState(
            starting_capital=self._account.starting_capital,
            cash=self._account.cash + pnl,
        )

    # -- snapshot ---------------------------------------------------------- #

    def snapshot(
        self,
        marks: dict[UUID, Decimal],
        captured_at: Optional[datetime] = None,
    ) -> PortfolioSnapshot:
        """Produce an immutable PortfolioSnapshot.

        marks   — {instrument_id: current_price}; missing marks excluded from
                  unrealized PnL (fail-safe §13).
        All Decimal; deterministic for fixed inputs.
        """
        if captured_at is None:
            captured_at = datetime.now(timezone.utc)

        open_positions = self._open.list()
        closed_positions = self._closed.list()

        realized_pnl = PnLCalculator.realized(closed_positions)
        unrealized_pnl = PnLCalculator.unrealized(open_positions, marks)
        equity = self._account.cash + unrealized_pnl

        self._equity_tracker.update(equity)
        hwm = self._equity_tracker.high_water_mark
        drawdown = self._equity_tracker.drawdown(equity)

        open_count = len(open_positions)
        core_open = self._open.count(engine=EngineType.CORE)
        turbo_open = self._open.count(engine=EngineType.TURBO)

        sc = self._account.starting_capital
        core_exposure = _position_exposure(self._open.list(engine=EngineType.CORE), marks)
        turbo_exposure = _position_exposure(self._open.list(engine=EngineType.TURBO), marks)
        core_allocation = core_exposure / sc
        turbo_allocation = turbo_exposure / sc

        return PortfolioSnapshot(
            starting_capital=sc,
            cash=self._account.cash,
            realized_pnl=realized_pnl,
            unrealized_pnl=unrealized_pnl,
            equity=equity,
            high_water_mark=hwm,
            drawdown=drawdown,
            open_positions=open_count,
            core_open=core_open,
            turbo_open=turbo_open,
            core_exposure=core_exposure,
            turbo_exposure=turbo_exposure,
            core_allocation=core_allocation,
            turbo_allocation=turbo_allocation,
            captured_at=captured_at,
        )

    # -- statistics -------------------------------------------------------- #

    def period_stats(
        self,
        period_type: str,
        start: datetime,
        end: datetime,
    ) -> PeriodStats:
        """Compute D/W/M statistics for closed positions within [start, end]."""
        return StatisticsCalculator.stats(
            self._closed.list(),
            period_type=period_type,
            start=start,
            end=end,
        )

    def persist_stats(self, stats: PeriodStats, dal) -> PerformanceRecord:
        """Write PeriodStats to the existing performance_records table via D2.

        Creates a PerformanceRecord and calls dal.performance_records.add.
        No new entity, no schema change — appends to the pre-existing table.
        """
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
            created_at=datetime.now(timezone.utc),
        )
        dal.performance_records.add(record)
        return record

    # -- sector exposure (figure for D4 consumption) ----------------------- #

    def sector_exposure(
        self,
        sector_id: UUID,
        instruments: dict[UUID, object],
        marks: dict[UUID, Decimal],
    ) -> Decimal:
        """Sector exposure as fraction of starting_capital.

        B6 supplies the figure; D4 enforces the ≤25% sector gate (§10).
        instruments — {instrument_id: Instrument}
        """
        sector_positions = [
            p for p in self._open.list()
            if (inst := instruments.get(p.instrument_id)) is not None
            and inst.sector_id == sector_id
        ]
        exposure = _position_exposure(sector_positions, marks)
        return exposure / self._account.starting_capital

    # -- read-only accessors ----------------------------------------------- #

    @property
    def account(self) -> AccountState:
        return self._account

    @property
    def open_count(self) -> int:
        return self._open.count()

    @property
    def closed_count(self) -> int:
        return self._closed.count()


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #

def _position_exposure(positions: list[Position], marks: dict[UUID, Decimal]) -> Decimal:
    """Gross exposure for a list of positions.

    Uses current mark where available; falls back to entry_price; if neither is
    present uses zero. Always positive (measures risk exposure, not net PnL).
    """
    total = Decimal("0")
    for p in positions:
        price = marks.get(p.instrument_id)
        if price is None:
            price = p.entry_price or Decimal("0")
        total += price * Decimal(p.quantity)
    return total


__all__ = ["PortfolioState"]
