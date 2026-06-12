"""D1 unit tests — domain model construction & typing.

Verifies all 19 models (17 entities + 2 bridges) exist, are dataclasses, and
construct with the required field types (Decimal money, UUID ids, tz-aware
datetimes, enum-typed fields). No network, no DB.
"""

import dataclasses
import unittest
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from src import models
from src.enums import (
    AuditEventType,
    Direction,
    EngineType,
    Market,
    MarketRegime,
    OrderStatus,
    PositionStatus,
    RiskDecision,
    SeverityLevel,
    SystemEventType,
    TradeClassification,
    UserRole,
)

NOW = datetime(2026, 6, 1, 14, 30, tzinfo=timezone.utc)

EXPECTED_MODELS = [
    "Sector", "User", "Instrument", "MarketSnapshot", "ScannerResult",
    "Signal", "Score", "RiskCheck", "Order", "Position", "Fill",
    "RiskSnapshot", "NewsEvent", "EarningsEvent", "PerformanceRecord",
    "AuditLog", "SystemEvent", "SignalNews", "SignalEarnings",
]


class TestModelInventory(unittest.TestCase):
    def test_nineteen_models_exported(self):
        self.assertEqual(len(models.__all__), 19)
        self.assertEqual(set(models.__all__), set(EXPECTED_MODELS))

    def test_all_are_dataclasses(self):
        for name in EXPECTED_MODELS:
            cls = getattr(models, name)
            self.assertTrue(dataclasses.is_dataclass(cls), f"{name} not a dataclass")


class TestModelConstruction(unittest.TestCase):
    """Construct each model and assert representative field types."""

    def test_sector(self):
        s = models.Sector(id=uuid4(), name="Technology", created_at=NOW)
        self.assertEqual(s.name, "Technology")
        self.assertEqual(s.created_at.tzinfo, timezone.utc)

    def test_user(self):
        u = models.User(id=uuid4(), username="owner1", role=UserRole.OWNER, created_at=NOW)
        self.assertIsInstance(u.role, UserRole)
        self.assertTrue(u.is_active)

    def test_instrument(self):
        i = models.Instrument(
            id=uuid4(), symbol="AAPL", market=Market.NASDAQ,
            sector_id=uuid4(), created_at=NOW,
        )
        self.assertIsInstance(i.market, Market)

    def test_market_snapshot_nullable_vix_state(self):
        m = models.MarketSnapshot(
            id=uuid4(), captured_at=NOW, regime=MarketRegime.BULL,
            spy_price=Decimal("512.34"), spy_sma_200=Decimal("498.10"),
        )
        self.assertIsInstance(m.spy_price, Decimal)
        self.assertIsNone(m.vix)
        self.assertIsNone(m.state)

    def test_scanner_result(self):
        r = models.ScannerResult(
            id=uuid4(), instrument_id=uuid4(), engine=EngineType.CORE, created_at=NOW,
        )
        self.assertIsInstance(r.engine, EngineType)
        self.assertFalse(r.passed)

    def test_signal(self):
        sig = models.Signal(
            id=uuid4(), created_at=NOW, instrument_id=uuid4(),
            engine=EngineType.TURBO, direction=Direction.LONG,
        )
        self.assertIsInstance(sig.direction, Direction)

    def test_score(self):
        sc = models.Score(
            id=uuid4(), signal_id=uuid4(), engine=EngineType.CORE,
            total=Decimal("96"), classification=TradeClassification.GOLDEN,
            created_at=NOW,
        )
        self.assertIsInstance(sc.total, Decimal)
        self.assertIsInstance(sc.classification, TradeClassification)
        self.assertEqual(sc.breakdown, {})

    def test_risk_check(self):
        rc = models.RiskCheck(
            id=uuid4(), signal_id=uuid4(), decision=RiskDecision.ACCEPTED, created_at=NOW,
        )
        self.assertIsInstance(rc.decision, RiskDecision)
        self.assertIsNone(rc.rejected_by)

    def test_order(self):
        o = models.Order(
            id=uuid4(), created_at=NOW, instrument_id=uuid4(), user_id=uuid4(),
            engine=EngineType.CORE, direction=Direction.LONG,
            status=OrderStatus.NEW, quantity=100,
        )
        self.assertIsInstance(o.status, OrderStatus)
        self.assertEqual(o.quantity, 100)
        self.assertIsNone(o.position_id)

    def test_position(self):
        p = models.Position(
            id=uuid4(), instrument_id=uuid4(), engine=EngineType.CORE,
            direction=Direction.LONG, status=PositionStatus.OPEN,
            quantity=100, opened_at=NOW,
        )
        self.assertIsInstance(p.status, PositionStatus)
        self.assertIsNone(p.closed_at)

    def test_fill(self):
        f = models.Fill(
            id=uuid4(), order_id=uuid4(), position_id=uuid4(),
            quantity=50, price=Decimal("187.42"), filled_at=NOW,
        )
        self.assertIsInstance(f.price, Decimal)

    def test_risk_snapshot(self):
        rs = models.RiskSnapshot(
            id=uuid4(), captured_at=NOW, equity=Decimal("100000"),
            high_water_mark=Decimal("105000"), daily_drawdown=Decimal("-0.01"),
            weekly_drawdown=Decimal("-0.02"), open_positions=3,
            trades_today=2, consecutive_losses=0,
        )
        self.assertIsInstance(rs.equity, Decimal)
        self.assertEqual(rs.open_positions, 3)

    def test_news_event(self):
        n = models.NewsEvent(
            id=uuid4(), instrument_id=uuid4(), published_at=NOW, created_at=NOW,
        )
        self.assertIsNone(n.headline)

    def test_earnings_event(self):
        e = models.EarningsEvent(
            id=uuid4(), instrument_id=uuid4(), event_date=NOW, created_at=NOW,
        )
        self.assertIsNone(e.surprise)

    def test_performance_record(self):
        pr = models.PerformanceRecord(
            id=uuid4(), period_type="daily", period_start=NOW, period_end=NOW,
            trades=5, wins=3, losses=2, realized_pnl=Decimal("1250.00"),
            win_rate=Decimal("0.6"), created_at=NOW,
        )
        self.assertIsInstance(pr.realized_pnl, Decimal)
        self.assertIn(pr.period_type, {"daily", "weekly", "monthly"})

    def test_audit_log(self):
        a = models.AuditLog(
            id=uuid4(), created_at=NOW, event_type=AuditEventType.LOGIN,
        )
        self.assertIsInstance(a.event_type, AuditEventType)

    def test_system_event(self):
        se = models.SystemEvent(
            id=uuid4(), created_at=NOW, event_type=SystemEventType.SERVICE_STARTED,
            severity=SeverityLevel.WARNING,
        )
        self.assertIsInstance(se.event_type, SystemEventType)
        self.assertIsInstance(se.severity, SeverityLevel)

    def test_bridges(self):
        sn = models.SignalNews(signal_id=uuid4(), news_event_id=uuid4())
        se = models.SignalEarnings(signal_id=uuid4(), earnings_event_id=uuid4())
        self.assertTrue(dataclasses.is_dataclass(sn))
        self.assertTrue(dataclasses.is_dataclass(se))


if __name__ == "__main__":
    unittest.main()
