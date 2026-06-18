"""D2 unit tests — Data Access Layer.

Covers: CRUD, duplicate protection, filter validation, append-only,
bridges, 1:1 lookups, Order→Fill→Position shape, transactions, count,
and DAL wiring. 100% offline (no DB / Redis / network).
"""

import unittest
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from src.data_access import (
    DataAccessLayer,
    DataLayerError,
    DuplicateEntity,
    EntityNotFound,
    ImmutableViolation,
    InMemoryRepository,
)
from src.enums import (
    AuditEventType,
    Direction,
    EngineType,
    Market,
    OrderStatus,
    PositionStatus,
    RiskDecision,
    SeverityLevel,
    SystemEventType,
    TradeClassification,
)
from src.models import (
    AuditLog,
    Fill,
    Instrument,
    Order,
    Position,
    RiskCheck,
    Score,
    Sector,
    Signal,
    SignalNews,
    SystemEvent,
)

NOW = datetime(2026, 6, 1, 14, 30, tzinfo=timezone.utc)


def make_sector(name="Technology"):
    return Sector(id=uuid4(), name=name, created_at=NOW)


def make_instrument(sector_id, symbol="AAPL"):
    return Instrument(
        id=uuid4(), symbol=symbol, market=Market.NASDAQ,
        sector_id=sector_id, created_at=NOW,
    )


def make_signal():
    return Signal(
        id=uuid4(), created_at=NOW, instrument_id=uuid4(),
        engine=EngineType.CORE, direction=Direction.LONG,
    )


# --------------------------------------------------------------------------- #
class TestCRUD(unittest.TestCase):
    def setUp(self):
        self.dal = DataAccessLayer()

    def test_add_and_get(self):
        s = make_sector()
        self.dal.sectors.add(s)
        self.assertEqual(self.dal.sectors.get(s.id), s)

    def test_get_missing_raises(self):
        with self.assertRaises(EntityNotFound):
            self.dal.sectors.get(uuid4())

    def test_get_or_none(self):
        self.assertIsNone(self.dal.sectors.get_or_none(uuid4()))

    def test_update(self):
        s = make_sector()
        self.dal.sectors.add(s)
        s2 = Sector(id=s.id, name="Renamed", created_at=NOW)
        self.dal.sectors.update(s2)
        self.assertEqual(self.dal.sectors.get(s.id).name, "Renamed")

    def test_update_missing_raises(self):
        with self.assertRaises(EntityNotFound):
            self.dal.sectors.update(make_sector())

    def test_delete(self):
        s = make_sector()
        self.dal.sectors.add(s)
        self.dal.sectors.delete(s.id)
        self.assertIsNone(self.dal.sectors.get_or_none(s.id))

    def test_delete_missing_raises(self):
        with self.assertRaises(EntityNotFound):
            self.dal.sectors.delete(uuid4())

    def test_list_and_count(self):
        sec = make_sector()
        self.dal.sectors.add(sec)
        self.dal.instruments.add(make_instrument(sec.id, "AAPL"))
        self.dal.instruments.add(make_instrument(sec.id, "MSFT"))
        self.assertEqual(self.dal.instruments.count(), 2)
        self.assertEqual(self.dal.instruments.count(symbol="AAPL"), 1)


class TestDuplicateProtection(unittest.TestCase):
    def setUp(self):
        self.dal = DataAccessLayer()

    def test_duplicate_id(self):
        s = make_sector()
        self.dal.sectors.add(s)
        with self.assertRaises(DuplicateEntity):
            self.dal.sectors.add(s)

    def test_duplicate_unique_field_name(self):
        self.dal.sectors.add(make_sector("Tech"))
        with self.assertRaises(DuplicateEntity):
            self.dal.sectors.add(make_sector("Tech"))

    def test_duplicate_unique_symbol(self):
        sec = make_sector()
        self.dal.sectors.add(sec)
        self.dal.instruments.add(make_instrument(sec.id, "AAPL"))
        with self.assertRaises(DuplicateEntity):
            self.dal.instruments.add(make_instrument(sec.id, "AAPL"))

    def test_duplicate_signal_id_in_scores(self):
        sig = uuid4()
        self.dal.scores.add(Score(
            id=uuid4(), signal_id=sig, engine=EngineType.CORE,
            total=Decimal("96"), classification=TradeClassification.GOLDEN,
            created_at=NOW,
        ))
        with self.assertRaises(DuplicateEntity):
            self.dal.scores.add(Score(
                id=uuid4(), signal_id=sig, engine=EngineType.CORE,
                total=Decimal("91"), classification=TradeClassification.STRONG,
                created_at=NOW,
            ))


class TestFilterValidation(unittest.TestCase):
    def setUp(self):
        self.dal = DataAccessLayer()

    def test_unknown_filter_field_raises(self):
        with self.assertRaises(DataLayerError):
            self.dal.sectors.list(nonexistent_field="x")

    def test_unknown_count_field_raises(self):
        with self.assertRaises(DataLayerError):
            self.dal.instruments.count(bogus=1)

    def test_wrong_entity_type_raises(self):
        with self.assertRaises(DataLayerError):
            self.dal.sectors.add(make_signal())


class TestAppendOnly(unittest.TestCase):
    def setUp(self):
        self.dal = DataAccessLayer()

    def test_audit_logs_update_forbidden(self):
        a = AuditLog(id=uuid4(), created_at=NOW, event_type=AuditEventType.LOGIN)
        self.dal.audit_logs.add(a)
        with self.assertRaises(ImmutableViolation):
            self.dal.audit_logs.update(a)

    def test_audit_logs_delete_forbidden(self):
        a = AuditLog(id=uuid4(), created_at=NOW, event_type=AuditEventType.LOGIN)
        self.dal.audit_logs.add(a)
        with self.assertRaises(ImmutableViolation):
            self.dal.audit_logs.delete(a.id)

    def test_system_events_append_only(self):
        e = SystemEvent(
            id=uuid4(), created_at=NOW,
            event_type=SystemEventType.SERVICE_STARTED, severity=SeverityLevel.WARNING,
        )
        self.dal.system_events.add(e)
        with self.assertRaises(ImmutableViolation):
            self.dal.system_events.delete(e.id)
        # add is still allowed
        self.assertEqual(self.dal.system_events.count(), 1)


class TestBridges(unittest.TestCase):
    def setUp(self):
        self.dal = DataAccessLayer()

    def test_bridge_add_list_delete(self):
        sig, news = uuid4(), uuid4()
        self.dal.signal_news.add(SignalNews(signal_id=sig, news_event_id=news))
        self.assertEqual(len(self.dal.signal_news.list(signal_id=sig)), 1)
        self.dal.signal_news.delete(sig, news)
        self.assertEqual(self.dal.signal_news.count(), 0)

    def test_bridge_duplicate(self):
        sig, news = uuid4(), uuid4()
        link = SignalNews(signal_id=sig, news_event_id=news)
        self.dal.signal_news.add(link)
        with self.assertRaises(DuplicateEntity):
            self.dal.signal_news.add(link)

    def test_bridge_delete_missing(self):
        with self.assertRaises(EntityNotFound):
            self.dal.signal_news.delete(uuid4(), uuid4())


class TestOneToOneLookups(unittest.TestCase):
    def setUp(self):
        self.dal = DataAccessLayer()

    def test_score_for_signal(self):
        sig = uuid4()
        sc = Score(id=uuid4(), signal_id=sig, engine=EngineType.CORE,
                   total=Decimal("100"), classification=TradeClassification.ULTRA_GOLDEN,
                   created_at=NOW)
        self.dal.scores.add(sc)
        self.assertEqual(self.dal.score_for_signal(sig), sc)
        self.assertIsNone(self.dal.score_for_signal(uuid4()))

    def test_risk_check_for_signal(self):
        sig = uuid4()
        rc = RiskCheck(id=uuid4(), signal_id=sig, decision=RiskDecision.ACCEPTED,
                       created_at=NOW)
        self.dal.risk_checks.add(rc)
        self.assertEqual(self.dal.risk_check_for_signal(sig), rc)


class TestExecutionChainShape(unittest.TestCase):
    """Order 1─* Fill · Fill *─1 Position · Order *─1 Position (shape, no logic)."""

    def setUp(self):
        self.dal = DataAccessLayer()

    def test_one_order_many_fills_one_position(self):
        position_id, order_id = uuid4(), uuid4()
        self.dal.positions.add(Position(
            id=position_id, instrument_id=uuid4(), engine=EngineType.CORE,
            direction=Direction.LONG, status=PositionStatus.OPEN,
            quantity=100, opened_at=NOW,
        ))
        self.dal.orders.add(Order(
            id=order_id, created_at=NOW, instrument_id=uuid4(), user_id=uuid4(),
            engine=EngineType.CORE, direction=Direction.LONG,
            status=OrderStatus.FILLED, quantity=100, position_id=position_id,
        ))
        for q in (40, 60):
            self.dal.fills.add(Fill(
                id=uuid4(), order_id=order_id, position_id=position_id,
                quantity=q, price=Decimal("187.00"), filled_at=NOW,
            ))
        self.assertEqual(len(self.dal.fills_for_order(order_id)), 2)
        self.assertEqual(len(self.dal.fills_for_position(position_id)), 2)
        self.assertEqual(len(self.dal.orders_for_position(position_id)), 1)


class TestTransaction(unittest.TestCase):
    def setUp(self):
        self.dal = DataAccessLayer()

    def test_commit_persists(self):
        s = make_sector()
        with self.dal.transaction() as tx:
            tx.sectors.add(s)
        self.assertIsNotNone(self.dal.sectors.get_or_none(s.id))

    def test_rollback_on_exception(self):
        sec = make_sector()
        self.dal.sectors.add(sec)
        with self.assertRaises(RuntimeError):
            with self.dal.transaction() as tx:
                tx.instruments.add(make_instrument(sec.id, "AAPL"))
                raise RuntimeError("boom")
        # the instrument added inside the aborted tx must be rolled back
        self.assertEqual(self.dal.instruments.count(), 0)
        # pre-existing data survives
        self.assertEqual(self.dal.sectors.count(), 1)

    def test_rollback_restores_updates(self):
        s = make_sector("Orig")
        self.dal.sectors.add(s)
        with self.assertRaises(RuntimeError):
            with self.dal.transaction() as tx:
                tx.sectors.update(Sector(id=s.id, name="Changed", created_at=NOW))
                raise RuntimeError("boom")
        self.assertEqual(self.dal.sectors.get(s.id).name, "Orig")


class TestDALWiring(unittest.TestCase):
    def test_nineteen_repositories(self):
        dal = DataAccessLayer()
        self.assertEqual(len(dal.repositories), 19)

    def test_append_only_repos_flagged(self):
        dal = DataAccessLayer()
        self.assertTrue(dal.audit_logs.append_only)
        self.assertTrue(dal.system_events.append_only)
        self.assertFalse(dal.orders.append_only)

    def test_repositories_are_independent_instances(self):
        dal = DataAccessLayer()
        self.assertIsInstance(dal.orders, InMemoryRepository)
        self.assertIsNot(dal.orders, dal.fills)


if __name__ == "__main__":
    unittest.main()
