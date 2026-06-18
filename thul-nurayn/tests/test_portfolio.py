"""THUL-NURAYN v1 — B6 Portfolio & State unit tests.

37 tests covering all Definition-of-Done criteria (B6_PORTFOLIO_ARCHITECTURE §17.10):
  Long/Short realized PnL · unrealized with/without marks · equity · HWM ·
  drawdown = 0 at HWM · registries by engine · statistics windows ·
  snapshot · missing-mark fail-safe · 70/30 monitoring · invalid-capital fail-safe.
"""

from __future__ import annotations

import unittest
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from src.enums import Direction, EngineType, PositionStatus
from src.models import Instrument, Market, PerformanceRecord, Position
from src.data_access import DataAccessLayer
from src.portfolio import (
    ClosedPositionsRegistry,
    EquityTracker,
    InvalidCapital,
    OpenPositionsRegistry,
    PnLCalculator,
    PortfolioState,
    PositionStateError,
    StatisticsCalculator,
)


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #

_UTC = timezone.utc


def _ts(year: int = 2024, month: int = 1, day: int = 1) -> datetime:
    return datetime(year, month, day, tzinfo=_UTC)


def _open_pos(
    instrument_id=None,
    engine=EngineType.CORE,
    direction=Direction.LONG,
    quantity=100,
    entry_price="10.00",
) -> Position:
    return Position(
        id=uuid4(),
        instrument_id=instrument_id or uuid4(),
        engine=engine,
        direction=direction,
        status=PositionStatus.OPEN,
        quantity=quantity,
        opened_at=_ts(),
        entry_price=Decimal(entry_price),
    )


def _closed_pos(
    instrument_id=None,
    engine=EngineType.CORE,
    direction=Direction.LONG,
    quantity=100,
    entry_price="10.00",
    exit_price="15.00",
    closed_at=None,
) -> Position:
    return Position(
        id=uuid4(),
        instrument_id=instrument_id or uuid4(),
        engine=engine,
        direction=direction,
        status=PositionStatus.CLOSED,
        quantity=quantity,
        opened_at=_ts(),
        entry_price=Decimal(entry_price),
        exit_price=Decimal(exit_price),
        closed_at=closed_at or _ts(2024, 1, 10),
    )


# --------------------------------------------------------------------------- #
# PnLCalculator
# --------------------------------------------------------------------------- #

class TestPnLCalculator(unittest.TestCase):

    def test_long_realized(self):
        pos = _closed_pos(direction=Direction.LONG, entry_price="10.00", exit_price="15.00", quantity=100)
        self.assertEqual(PnLCalculator.realized_for_position(pos), Decimal("500.00"))

    def test_short_realized(self):
        pos = _closed_pos(direction=Direction.SHORT, entry_price="20.00", exit_price="15.00", quantity=100)
        self.assertEqual(PnLCalculator.realized_for_position(pos), Decimal("500.00"))

    def test_long_realized_loss(self):
        pos = _closed_pos(direction=Direction.LONG, entry_price="15.00", exit_price="10.00", quantity=100)
        self.assertEqual(PnLCalculator.realized_for_position(pos), Decimal("-500.00"))

    def test_realized_missing_entry_returns_zero(self):
        pos = Position(
            id=uuid4(), instrument_id=uuid4(), engine=EngineType.CORE,
            direction=Direction.LONG, status=PositionStatus.CLOSED,
            quantity=100, opened_at=_ts(), entry_price=None,
            exit_price=Decimal("15.00"), closed_at=_ts(2024, 1, 10),
        )
        self.assertEqual(PnLCalculator.realized_for_position(pos), Decimal("0"))

    def test_realized_missing_exit_returns_zero(self):
        pos = Position(
            id=uuid4(), instrument_id=uuid4(), engine=EngineType.CORE,
            direction=Direction.LONG, status=PositionStatus.CLOSED,
            quantity=100, opened_at=_ts(), entry_price=Decimal("10.00"),
            exit_price=None, closed_at=_ts(2024, 1, 10),
        )
        self.assertEqual(PnLCalculator.realized_for_position(pos), Decimal("0"))

    def test_realized_sum_multiple(self):
        pos1 = _closed_pos(entry_price="10.00", exit_price="12.00", quantity=100)  # +200
        pos2 = _closed_pos(entry_price="10.00", exit_price="8.00", quantity=50)   # -100
        total = PnLCalculator.realized([pos1, pos2])
        self.assertEqual(total, Decimal("100.00"))

    def test_unrealized_long_with_mark(self):
        iid = uuid4()
        pos = _open_pos(instrument_id=iid, direction=Direction.LONG, entry_price="10.00", quantity=100)
        pnl = PnLCalculator.unrealized([pos], {iid: Decimal("12.00")})
        self.assertEqual(pnl, Decimal("200.00"))

    def test_unrealized_short_with_mark(self):
        iid = uuid4()
        pos = _open_pos(instrument_id=iid, direction=Direction.SHORT, entry_price="20.00", quantity=100)
        pnl = PnLCalculator.unrealized([pos], {iid: Decimal("15.00")})
        self.assertEqual(pnl, Decimal("500.00"))

    def test_unrealized_missing_mark_excluded(self):
        iid = uuid4()
        pos = _open_pos(instrument_id=iid, direction=Direction.LONG, entry_price="10.00", quantity=100)
        # marks dict does not contain this instrument → excluded (fail-safe §13)
        pnl = PnLCalculator.unrealized([pos], {})
        self.assertEqual(pnl, Decimal("0"))

    def test_unrealized_missing_entry_excluded(self):
        iid = uuid4()
        pos = Position(
            id=uuid4(), instrument_id=iid, engine=EngineType.CORE,
            direction=Direction.LONG, status=PositionStatus.OPEN,
            quantity=100, opened_at=_ts(), entry_price=None,
        )
        pnl = PnLCalculator.unrealized([pos], {iid: Decimal("12.00")})
        self.assertEqual(pnl, Decimal("0"))


# --------------------------------------------------------------------------- #
# EquityTracker
# --------------------------------------------------------------------------- #

class TestEquityTracker(unittest.TestCase):

    def test_hwm_initialized_to_starting_capital(self):
        et = EquityTracker(Decimal("100000"))
        self.assertEqual(et.high_water_mark, Decimal("100000"))

    def test_hwm_rises_with_equity(self):
        et = EquityTracker(Decimal("100000"))
        et.update(Decimal("105000"))
        self.assertEqual(et.high_water_mark, Decimal("105000"))

    def test_hwm_stays_when_equity_below(self):
        et = EquityTracker(Decimal("100000"))
        et.update(Decimal("105000"))
        et.update(Decimal("95000"))
        self.assertEqual(et.high_water_mark, Decimal("105000"))

    def test_drawdown_zero_at_hwm(self):
        et = EquityTracker(Decimal("100000"))
        et.update(Decimal("100000"))
        dd = et.drawdown(Decimal("100000"))
        self.assertEqual(dd, Decimal("0"))

    def test_drawdown_negative_below_hwm(self):
        et = EquityTracker(Decimal("100000"))
        et.update(Decimal("110000"))
        dd = et.drawdown(Decimal("99000"))
        # (99000 - 110000) / 110000 = -11000/110000 = -0.1
        expected = Decimal("-11000") / Decimal("110000")
        self.assertEqual(dd, expected)
        self.assertLess(dd, Decimal("0"))


# --------------------------------------------------------------------------- #
# OpenPositionsRegistry
# --------------------------------------------------------------------------- #

class TestOpenPositionsRegistry(unittest.TestCase):

    def test_add_and_list(self):
        reg = OpenPositionsRegistry()
        pos = _open_pos()
        reg.add(pos)
        self.assertEqual(reg.list(), [pos])

    def test_list_by_engine(self):
        reg = OpenPositionsRegistry()
        core_pos = _open_pos(engine=EngineType.CORE)
        turbo_pos = _open_pos(engine=EngineType.TURBO)
        reg.add(core_pos)
        reg.add(turbo_pos)
        self.assertEqual(reg.list(engine=EngineType.CORE), [core_pos])
        self.assertEqual(reg.list(engine=EngineType.TURBO), [turbo_pos])

    def test_count_by_engine(self):
        reg = OpenPositionsRegistry()
        reg.add(_open_pos(engine=EngineType.CORE))
        reg.add(_open_pos(engine=EngineType.CORE))
        reg.add(_open_pos(engine=EngineType.TURBO))
        self.assertEqual(reg.count(engine=EngineType.CORE), 2)
        self.assertEqual(reg.count(engine=EngineType.TURBO), 1)
        self.assertEqual(reg.count(), 3)

    def test_remove(self):
        reg = OpenPositionsRegistry()
        pos = _open_pos()
        reg.add(pos)
        removed = reg.remove(pos.id)
        self.assertEqual(removed, pos)
        self.assertEqual(reg.list(), [])

    def test_duplicate_add_raises(self):
        reg = OpenPositionsRegistry()
        pos = _open_pos()
        reg.add(pos)
        with self.assertRaises(PositionStateError):
            reg.add(pos)

    def test_remove_missing_raises(self):
        reg = OpenPositionsRegistry()
        with self.assertRaises(PositionStateError):
            reg.remove(uuid4())


# --------------------------------------------------------------------------- #
# ClosedPositionsRegistry
# --------------------------------------------------------------------------- #

class TestClosedPositionsRegistry(unittest.TestCase):

    def test_add_and_list(self):
        reg = ClosedPositionsRegistry()
        pos = _closed_pos()
        reg.add(pos)
        self.assertIn(pos, reg.list())

    def test_list_by_engine(self):
        reg = ClosedPositionsRegistry()
        core_pos = _closed_pos(engine=EngineType.CORE)
        turbo_pos = _closed_pos(engine=EngineType.TURBO)
        reg.add(core_pos)
        reg.add(turbo_pos)
        self.assertEqual(reg.list(engine=EngineType.CORE), [core_pos])
        self.assertEqual(reg.list(engine=EngineType.TURBO), [turbo_pos])

    def test_count(self):
        reg = ClosedPositionsRegistry()
        reg.add(_closed_pos(engine=EngineType.CORE))
        reg.add(_closed_pos(engine=EngineType.TURBO))
        self.assertEqual(reg.count(), 2)
        self.assertEqual(reg.count(engine=EngineType.CORE), 1)


# --------------------------------------------------------------------------- #
# StatisticsCalculator
# --------------------------------------------------------------------------- #

class TestStatisticsCalculator(unittest.TestCase):

    def test_stats_all_wins(self):
        pos1 = _closed_pos(entry_price="10.00", exit_price="12.00", closed_at=_ts(2024, 1, 5))
        pos2 = _closed_pos(entry_price="10.00", exit_price="13.00", closed_at=_ts(2024, 1, 8))
        stats = StatisticsCalculator.stats(
            [pos1, pos2], "daily", _ts(2024, 1, 1), _ts(2024, 1, 10)
        )
        self.assertEqual(stats.trades, 2)
        self.assertEqual(stats.wins, 2)
        self.assertEqual(stats.losses, 0)
        self.assertEqual(stats.win_rate, Decimal("1"))
        self.assertEqual(stats.realized_pnl, Decimal("500.00"))

    def test_stats_mixed_wins_losses(self):
        win = _closed_pos(entry_price="10.00", exit_price="12.00", quantity=100, closed_at=_ts(2024, 1, 3))
        loss = _closed_pos(entry_price="10.00", exit_price="8.00", quantity=100, closed_at=_ts(2024, 1, 5))
        stats = StatisticsCalculator.stats(
            [win, loss], "daily", _ts(2024, 1, 1), _ts(2024, 1, 10)
        )
        self.assertEqual(stats.trades, 2)
        self.assertEqual(stats.wins, 1)
        self.assertEqual(stats.losses, 1)
        self.assertEqual(stats.win_rate, Decimal("1") / Decimal("2"))
        self.assertEqual(stats.realized_pnl, Decimal("0.00"))

    def test_stats_outside_window_excluded(self):
        outside = _closed_pos(closed_at=_ts(2024, 2, 1))  # outside Jan window
        inside = _closed_pos(entry_price="10.00", exit_price="12.00", closed_at=_ts(2024, 1, 15))
        stats = StatisticsCalculator.stats(
            [outside, inside], "monthly", _ts(2024, 1, 1), _ts(2024, 1, 31)
        )
        self.assertEqual(stats.trades, 1)

    def test_stats_empty_window(self):
        stats = StatisticsCalculator.stats(
            [], "daily", _ts(2024, 1, 1), _ts(2024, 1, 10)
        )
        self.assertEqual(stats.trades, 0)
        self.assertEqual(stats.wins, 0)
        self.assertEqual(stats.losses, 0)
        self.assertEqual(stats.win_rate, Decimal("0"))
        self.assertEqual(stats.realized_pnl, Decimal("0"))


# --------------------------------------------------------------------------- #
# PortfolioState
# --------------------------------------------------------------------------- #

class TestPortfolioState(unittest.TestCase):

    def test_invalid_capital_zero_raises(self):
        with self.assertRaises(InvalidCapital):
            PortfolioState(Decimal("0"))

    def test_invalid_capital_negative_raises(self):
        with self.assertRaises(InvalidCapital):
            PortfolioState(Decimal("-1000"))

    def test_initial_state(self):
        ps = PortfolioState(Decimal("100000"))
        snap = ps.snapshot({})
        self.assertEqual(snap.cash, Decimal("100000"))
        self.assertEqual(snap.equity, Decimal("100000"))
        self.assertEqual(snap.realized_pnl, Decimal("0"))
        self.assertEqual(snap.unrealized_pnl, Decimal("0"))
        self.assertEqual(snap.high_water_mark, Decimal("100000"))
        self.assertEqual(snap.drawdown, Decimal("0"))
        self.assertEqual(snap.open_positions, 0)

    def test_open_position_reflected_in_snapshot(self):
        iid = uuid4()
        ps = PortfolioState(Decimal("100000"))
        ps.open_position(_open_pos(instrument_id=iid, entry_price="10.00", quantity=100))
        snap = ps.snapshot({iid: Decimal("12.00")})
        self.assertEqual(snap.open_positions, 1)
        self.assertEqual(snap.unrealized_pnl, Decimal("200.00"))
        self.assertEqual(snap.equity, Decimal("100200.00"))

    def test_close_position_long_updates_cash(self):
        iid = uuid4()
        ps = PortfolioState(Decimal("100000"))
        opened = _open_pos(instrument_id=iid, direction=Direction.LONG, entry_price="10.00", quantity=100)
        ps.open_position(opened)
        closed = _closed_pos(
            instrument_id=iid, direction=Direction.LONG,
            entry_price="10.00", exit_price="15.00", quantity=100,
        )
        # override id to match the opened position
        from dataclasses import replace
        closed = replace(closed, id=opened.id)
        ps.close_position(closed)
        self.assertEqual(ps.account.cash, Decimal("100500.00"))
        self.assertEqual(ps.open_count, 0)
        self.assertEqual(ps.closed_count, 1)

    def test_close_position_short_updates_cash(self):
        iid = uuid4()
        ps = PortfolioState(Decimal("100000"))
        opened = _open_pos(instrument_id=iid, direction=Direction.SHORT, entry_price="20.00", quantity=100)
        ps.open_position(opened)
        from dataclasses import replace
        closed = _closed_pos(
            instrument_id=iid, direction=Direction.SHORT,
            entry_price="20.00", exit_price="15.00", quantity=100,
        )
        closed = replace(closed, id=opened.id)
        ps.close_position(closed)
        self.assertEqual(ps.account.cash, Decimal("100500.00"))

    def test_snapshot_missing_mark_excluded_from_unrealized(self):
        iid = uuid4()
        ps = PortfolioState(Decimal("100000"))
        ps.open_position(_open_pos(instrument_id=iid, entry_price="10.00", quantity=100))
        snap = ps.snapshot({})  # no marks → position excluded (fail-safe §13)
        self.assertEqual(snap.unrealized_pnl, Decimal("0"))
        self.assertEqual(snap.equity, Decimal("100000"))

    def test_snapshot_hwm_rises_then_drawdown_zero(self):
        iid = uuid4()
        ps = PortfolioState(Decimal("100000"))
        # entry=10, qty=100 → unrealized @ mark=15: (15-10)*100 = 500, equity = 100500
        ps.open_position(_open_pos(instrument_id=iid, entry_price="10.00", quantity=100))
        snap1 = ps.snapshot({iid: Decimal("15.00")})
        self.assertEqual(snap1.high_water_mark, Decimal("100500.00"))
        self.assertEqual(snap1.drawdown, Decimal("0"))

    def test_snapshot_drawdown_below_hwm(self):
        iid = uuid4()
        ps = PortfolioState(Decimal("100000"))
        # entry=10, qty=100 → unrealized @ mark=20: (20-10)*100 = 1000, equity = 101000
        ps.open_position(_open_pos(instrument_id=iid, entry_price="10.00", quantity=100))
        ps.snapshot({iid: Decimal("20.00")})  # HWM → 101000
        # equity drops: (5-10)*100 = -500, equity = 99500
        snap = ps.snapshot({iid: Decimal("5.00")})
        self.assertLess(snap.drawdown, Decimal("0"))
        expected_dd = (Decimal("99500") - Decimal("101000")) / Decimal("101000")
        self.assertEqual(snap.drawdown, expected_dd)

    def test_snapshot_core_turbo_counts(self):
        ps = PortfolioState(Decimal("100000"))
        ps.open_position(_open_pos(engine=EngineType.CORE))
        ps.open_position(_open_pos(engine=EngineType.CORE))
        ps.open_position(_open_pos(engine=EngineType.TURBO))
        snap = ps.snapshot({})
        self.assertEqual(snap.core_open, 2)
        self.assertEqual(snap.turbo_open, 1)
        self.assertEqual(snap.open_positions, 3)

    def test_snapshot_70_30_allocation_monitoring(self):
        core_iid = uuid4()
        turbo_iid = uuid4()
        ps = PortfolioState(Decimal("100000"))
        # Core: 70 shares @ $1000 = $70,000 → 70% of 100000
        ps.open_position(_open_pos(instrument_id=core_iid, engine=EngineType.CORE, entry_price="1000.00", quantity=70))
        # Turbo: 30 shares @ $1000 = $30,000 → 30% of 100000
        ps.open_position(_open_pos(instrument_id=turbo_iid, engine=EngineType.TURBO, entry_price="1000.00", quantity=30))
        marks = {core_iid: Decimal("1000.00"), turbo_iid: Decimal("1000.00")}
        snap = ps.snapshot(marks)
        self.assertEqual(snap.core_exposure, Decimal("70000.00"))
        self.assertEqual(snap.turbo_exposure, Decimal("30000.00"))
        self.assertEqual(snap.core_allocation, Decimal("0.70"))
        self.assertEqual(snap.turbo_allocation, Decimal("0.30"))

    def test_snapshot_exposure_falls_back_to_entry_price(self):
        iid = uuid4()
        ps = PortfolioState(Decimal("100000"))
        ps.open_position(_open_pos(instrument_id=iid, engine=EngineType.CORE, entry_price="50.00", quantity=200))
        snap = ps.snapshot({})  # no marks; entry_price used for exposure
        self.assertEqual(snap.core_exposure, Decimal("10000.00"))

    def test_persist_stats_creates_performance_record(self):
        dal = DataAccessLayer()
        ps = PortfolioState(Decimal("100000"))
        stats = StatisticsCalculator.stats([], "daily", _ts(2024, 1, 1), _ts(2024, 1, 1))
        record = ps.persist_stats(stats, dal)
        self.assertIsInstance(record, PerformanceRecord)
        self.assertEqual(record.period_type, "daily")
        stored = dal.performance_records.list()
        self.assertEqual(len(stored), 1)
        self.assertEqual(stored[0].id, record.id)

    def test_sector_exposure(self):
        sector_id = uuid4()
        iid_a = uuid4()
        iid_b = uuid4()
        iid_other = uuid4()
        other_sector = uuid4()

        inst_a = Instrument(id=iid_a, symbol="A", market=Market.NASDAQ, sector_id=sector_id, created_at=_ts())
        inst_b = Instrument(id=iid_b, symbol="B", market=Market.NYSE, sector_id=sector_id, created_at=_ts())
        inst_other = Instrument(id=iid_other, symbol="C", market=Market.NASDAQ, sector_id=other_sector, created_at=_ts())

        instruments = {iid_a: inst_a, iid_b: inst_b, iid_other: inst_other}
        marks = {iid_a: Decimal("100.00"), iid_b: Decimal("200.00"), iid_other: Decimal("50.00")}

        ps = PortfolioState(Decimal("100000"))
        ps.open_position(_open_pos(instrument_id=iid_a, quantity=100))   # 100*100 = 10000
        ps.open_position(_open_pos(instrument_id=iid_b, quantity=50))    # 50*200 = 10000
        ps.open_position(_open_pos(instrument_id=iid_other, quantity=200))  # different sector

        exposure = ps.sector_exposure(sector_id, instruments, marks)
        # (10000 + 10000) / 100000 = 0.20
        self.assertEqual(exposure, Decimal("0.20"))

    def test_close_position_not_in_open_registry_raises(self):
        ps = PortfolioState(Decimal("100000"))
        closed = _closed_pos()
        with self.assertRaises(PositionStateError):
            ps.close_position(closed)  # never opened


if __name__ == "__main__":
    unittest.main()
