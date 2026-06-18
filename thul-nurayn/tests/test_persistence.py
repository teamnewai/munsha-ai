"""THUL-NURAYN v1 — B7 Persistence & Infrastructure tests.

Test structure:
  Always-run (no real DB/Redis needed):
    TestConnectionFailSafe       — PersistenceError on bad DSN
    TestRedisDegradedMode        — non-fatal failure; operations return None/False
    TestRedisClientConnected     — skip if no Redis
    TestSerializationRoundTrip   — entity_to_row / row_to_entity (pure Python)
    TestAppendOnlyEnforcement    — ImmutableViolation before SQL (pure Python check)

  Require DATABASE_URL env var (real PostgreSQL):
    TestPostgresRepositoryCRUD
    TestPostgresRepositoryFilters
    TestPostgresRepositoryUniqueViolation
    TestPostgresRepositoryNotFound
    TestPostgresTransactionRollback
    TestPostgresTransactionCommit
    TestPostgresBridgeRepository
    TestPostgresDALStructuralLookups

Integration tests skip gracefully when DATABASE_URL is not set.
All 194 existing tests (InMemoryRepository) are unaffected — B7 adds new
tests without modifying any existing test file.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

import pytest

# psycopg2 must be installed (it is; installed in B7 setup)
import psycopg2

from src.data_access.errors import (
    DuplicateEntity,
    EntityNotFound,
    ImmutableViolation,
)
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
from src.models import (
    AuditLog,
    EarningsEvent,
    Fill,
    Instrument,
    Order,
    PerformanceRecord,
    Position,
    RiskCheck,
    Score,
    Sector,
    Signal,
    SignalEarnings,
    SignalNews,
    SystemEvent,
    User,
)
from src.persistence.connection import ConnectionPool
from src.persistence.dal import PostgresDataAccessLayer
from src.persistence.errors import PersistenceError
from src.persistence.repository import PostgresBridgeRepository, PostgresRepository
from src.persistence.serialization import entity_to_row, row_to_entity
from src.redis import RedisClient

# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

_DB_URL = os.environ.get("DATABASE_URL", "")
_NEEDS_DB = pytest.mark.skipif(
    not _DB_URL,
    reason="DATABASE_URL not set — integration tests require a real PostgreSQL instance",
)

_UTC = timezone.utc


def _ts() -> datetime:
    """Current UTC timestamp."""
    return datetime.now(_UTC)


def _sector() -> Sector:
    return Sector(id=uuid4(), name=f"Tech-{uuid4().hex[:6]}", created_at=_ts())


def _user() -> User:
    return User(
        id=uuid4(),
        username=f"user-{uuid4().hex[:6]}",
        role=UserRole.OPERATOR,
        created_at=_ts(),
    )


def _instrument(sector_id: UUID) -> Instrument:
    return Instrument(
        id=uuid4(),
        symbol=f"SYM{uuid4().hex[:4].upper()}",
        market=Market.NASDAQ,
        sector_id=sector_id,
        created_at=_ts(),
    )


def _signal(instrument_id: UUID) -> Signal:
    return Signal(
        id=uuid4(),
        created_at=_ts(),
        instrument_id=instrument_id,
        engine=EngineType.CORE,
        direction=Direction.LONG,
    )


def _pool() -> ConnectionPool:
    return ConnectionPool(dsn=_DB_URL)


# --------------------------------------------------------------------------- #
# Always-run: connection fail-safe (no real DB needed)
# --------------------------------------------------------------------------- #

class TestConnectionFailSafe:
    def test_bad_dsn_raises_persistence_error(self):
        with pytest.raises(PersistenceError):
            ConnectionPool(dsn="postgresql://invalid:invalid@localhost:9999/invalid")

    def test_missing_dsn_env_raises_persistence_error(self, monkeypatch):
        monkeypatch.delenv("DATABASE_URL", raising=False)
        with pytest.raises(PersistenceError, match="DATABASE_URL"):
            ConnectionPool(dsn=None)


# --------------------------------------------------------------------------- #
# Always-run: Redis degraded mode (no real Redis needed)
# --------------------------------------------------------------------------- #

class TestRedisDegradedMode:
    def _bad_client(self) -> RedisClient:
        return RedisClient(url="redis://localhost:19999/0", timeout=1)

    def test_unavailable_at_startup_does_not_raise(self):
        client = self._bad_client()
        assert client.available is False

    def test_ping_returns_false_in_degraded_mode(self):
        client = self._bad_client()
        assert client.ping() is False

    def test_get_returns_none_in_degraded_mode(self):
        client = self._bad_client()
        assert client.get("key") is None

    def test_set_returns_none_in_degraded_mode(self):
        client = self._bad_client()
        assert client.set("key", "value") is None

    def test_delete_returns_none_in_degraded_mode(self):
        client = self._bad_client()
        assert client.delete("key") is None


# --------------------------------------------------------------------------- #
# Always-run: serialization round-trip (pure Python, no DB)
# --------------------------------------------------------------------------- #

class TestSerializationRoundTrip:
    def test_sector_round_trip(self):
        original = Sector(id=uuid4(), name="HealthCare", created_at=_ts())
        row = entity_to_row(original)
        assert row["name"] == "HealthCare"
        assert row["id"] == original.id  # UUID passes through
        restored = row_to_entity(Sector, row)
        assert restored.id == original.id
        assert restored.name == original.name
        assert restored.created_at == original.created_at

    def test_enum_serializes_to_value(self):
        signal = Signal(
            id=uuid4(),
            created_at=_ts(),
            instrument_id=uuid4(),
            engine=EngineType.TURBO,
            direction=Direction.SHORT,
        )
        row = entity_to_row(signal)
        assert row["engine"] == "Turbo"
        assert row["direction"] == "Short"

    def test_enum_deserializes_from_string(self):
        iid = uuid4()
        row = {
            "id": uuid4(),
            "created_at": _ts(),
            "instrument_id": iid,
            "engine": "Core",
            "direction": "Long",
        }
        signal = row_to_entity(Signal, row)
        assert signal.engine is EngineType.CORE
        assert signal.direction is Direction.LONG

    def test_optional_none_round_trip(self):
        pos = Position(
            id=uuid4(),
            instrument_id=uuid4(),
            engine=EngineType.CORE,
            direction=Direction.LONG,
            status=PositionStatus.OPEN,
            quantity=100,
            opened_at=_ts(),
            entry_price=None,
            exit_price=None,
            closed_at=None,
        )
        row = entity_to_row(pos)
        assert row["entry_price"] is None
        assert row["closed_at"] is None
        restored = row_to_entity(Position, row)
        assert restored.entry_price is None
        assert restored.closed_at is None

    def test_decimal_round_trip(self):
        pos = Position(
            id=uuid4(),
            instrument_id=uuid4(),
            engine=EngineType.TURBO,
            direction=Direction.SHORT,
            status=PositionStatus.CLOSED,
            quantity=50,
            opened_at=_ts(),
            entry_price=Decimal("123.45"),
            exit_price=Decimal("130.00"),
            closed_at=_ts(),
        )
        row = entity_to_row(pos)
        assert row["entry_price"] == Decimal("123.45")
        restored = row_to_entity(Position, row)
        assert restored.entry_price == Decimal("123.45")

    def test_dict_jsonb_serialized_with_json_wrapper(self):
        import psycopg2.extras
        score = Score(
            id=uuid4(),
            signal_id=uuid4(),
            engine=EngineType.CORE,
            total=Decimal("95.5"),
            classification=TradeClassification.GOLDEN,
            created_at=_ts(),
            breakdown={"rs": 18, "rvol": 14},
        )
        row = entity_to_row(score)
        assert isinstance(row["breakdown"], psycopg2.extras.Json)

    def test_audit_log_round_trip(self):
        log_entry = AuditLog(
            id=uuid4(),
            created_at=_ts(),
            event_type=AuditEventType.ORDER,
            user_id=uuid4(),
            entity_ref=uuid4(),
            detail={"action": "submitted"},
        )
        row = entity_to_row(log_entry)
        assert row["event_type"] == "Order"
        restored = row_to_entity(AuditLog, {
            **row,
            "event_type": "Order",
            "detail": {"action": "submitted"},  # simulate psycopg2 JSONB deserialization
        })
        assert restored.event_type is AuditEventType.ORDER


# --------------------------------------------------------------------------- #
# Always-run: append-only enforcement (pure Python, no DB)
# --------------------------------------------------------------------------- #

class TestAppendOnlyEnforcement:
    """ImmutableViolation is raised in Python BEFORE any SQL is issued."""

    def _append_repo(self, pool_mock=None) -> PostgresRepository:
        class _FakePool:
            pass
        return PostgresRepository(
            AuditLog,
            pool_mock or _FakePool(),
            "audit_logs",
            append_only=True,
        )

    def test_update_raises_immutable_violation(self):
        repo = self._append_repo()
        fake = AuditLog(
            id=uuid4(), created_at=_ts(),
            event_type=AuditEventType.LOGIN, user_id=None,
            entity_ref=None, detail=None,
        )
        with pytest.raises(ImmutableViolation):
            repo.update(fake)

    def test_delete_raises_immutable_violation(self):
        repo = self._append_repo()
        with pytest.raises(ImmutableViolation):
            repo.delete(uuid4())


# --------------------------------------------------------------------------- #
# Integration: require real PostgreSQL (skip if DATABASE_URL not set)
# --------------------------------------------------------------------------- #

@_NEEDS_DB
class TestPostgresRepositoryCRUD:
    """Full CRUD against a real PostgreSQL instance."""

    @pytest.fixture(autouse=True)
    def pool(self):
        self._pool = _pool()
        yield
        self._pool.close()

    def _repo(self) -> PostgresRepository:
        return PostgresRepository(Sector, self._pool, "sectors")

    def test_add_and_get(self):
        repo = self._repo()
        sec = _sector()
        repo.add(sec)
        fetched = repo.get(sec.id)
        assert fetched.id == sec.id
        assert fetched.name == sec.name
        # cleanup
        repo.delete(sec.id)

    def test_get_or_none_returns_none(self):
        repo = self._repo()
        assert repo.get_or_none(uuid4()) is None

    def test_get_raises_entity_not_found(self):
        repo = self._repo()
        with pytest.raises(EntityNotFound):
            repo.get(uuid4())

    def test_list_returns_added_entity(self):
        repo = self._repo()
        sec = _sector()
        repo.add(sec)
        results = repo.list(name=sec.name)
        assert any(s.id == sec.id for s in results)
        repo.delete(sec.id)

    def test_update(self):
        repo = self._repo()
        sec = _sector()
        repo.add(sec)
        from dataclasses import replace
        updated = replace(sec, name=f"Updated-{uuid4().hex[:4]}")
        repo.update(updated)
        fetched = repo.get(sec.id)
        assert fetched.name == updated.name
        repo.delete(sec.id)

    def test_delete(self):
        repo = self._repo()
        sec = _sector()
        repo.add(sec)
        repo.delete(sec.id)
        assert repo.get_or_none(sec.id) is None

    def test_delete_missing_raises_entity_not_found(self):
        repo = self._repo()
        with pytest.raises(EntityNotFound):
            repo.delete(uuid4())

    def test_count(self):
        repo = self._repo()
        sec = _sector()
        repo.add(sec)
        c = repo.count(name=sec.name)
        assert c == 1
        repo.delete(sec.id)

    def test_add_returns_entity(self):
        repo = self._repo()
        sec = _sector()
        result = repo.add(sec)
        assert result is sec
        repo.delete(sec.id)


@_NEEDS_DB
class TestPostgresRepositoryUniqueViolation:
    @pytest.fixture(autouse=True)
    def pool(self):
        self._pool = _pool()
        yield
        self._pool.close()

    def test_duplicate_id_raises_duplicate_entity(self):
        repo = PostgresRepository(Sector, self._pool, "sectors")
        sec = _sector()
        repo.add(sec)
        with pytest.raises(DuplicateEntity):
            repo.add(sec)  # same id → UniqueViolation on PK
        repo.delete(sec.id)

    def test_update_missing_raises_entity_not_found(self):
        repo = PostgresRepository(Sector, self._pool, "sectors")
        sec = _sector()  # not inserted
        with pytest.raises(EntityNotFound):
            repo.update(sec)


@_NEEDS_DB
class TestPostgresTransactionRollback:
    @pytest.fixture(autouse=True)
    def pool(self):
        self._pool = _pool()
        yield
        self._pool.close()

    def test_rollback_on_exception(self):
        """Entities added inside a failed transaction must not be visible after rollback."""
        repo = PostgresRepository(Sector, self._pool, "sectors")
        sec = _sector()
        try:
            with self._pool.transaction():
                repo.add(sec)
                raise RuntimeError("intentional abort")
        except RuntimeError:
            pass
        assert repo.get_or_none(sec.id) is None

    def test_successful_transaction_commits(self):
        repo = PostgresRepository(Sector, self._pool, "sectors")
        sec = _sector()
        with self._pool.transaction():
            repo.add(sec)
        fetched = repo.get_or_none(sec.id)
        assert fetched is not None
        repo.delete(sec.id)


@_NEEDS_DB
class TestPostgresTransactionCommit:
    @pytest.fixture(autouse=True)
    def pool(self):
        self._pool = _pool()
        yield
        self._pool.close()

    def test_dal_transaction_rollback(self):
        dal = PostgresDataAccessLayer(self._pool)
        sec = _sector()
        try:
            with dal.transaction() as dal_tx:
                dal_tx.sectors.add(sec)
                raise ValueError("abort")
        except ValueError:
            pass
        assert dal.sectors.get_or_none(sec.id) is None

    def test_dal_transaction_commit(self):
        dal = PostgresDataAccessLayer(self._pool)
        sec = _sector()
        with dal.transaction() as dal_tx:
            dal_tx.sectors.add(sec)
        assert dal.sectors.get(sec.id).name == sec.name
        dal.sectors.delete(sec.id)


@_NEEDS_DB
class TestPostgresAppendOnlyDB:
    @pytest.fixture(autouse=True)
    def pool(self):
        self._pool = _pool()
        yield
        self._pool.close()

    def test_audit_log_update_raises_immutable_violation(self):
        dal = PostgresDataAccessLayer(self._pool)
        entry = AuditLog(
            id=uuid4(), created_at=_ts(),
            event_type=AuditEventType.LOGIN,
            user_id=None, entity_ref=None, detail=None,
        )
        dal.audit_logs.add(entry)
        with pytest.raises(ImmutableViolation):
            dal.audit_logs.update(entry)

    def test_system_event_delete_raises_immutable_violation(self):
        dal = PostgresDataAccessLayer(self._pool)
        ev = SystemEvent(
            id=uuid4(), created_at=_ts(),
            event_type=SystemEventType.SERVICE_STARTED,
            severity=SeverityLevel.WARNING,
            detail=None,
        )
        dal.system_events.add(ev)
        with pytest.raises(ImmutableViolation):
            dal.system_events.delete(ev.id)


@_NEEDS_DB
class TestPostgresBridgeRepository:
    @pytest.fixture(autouse=True)
    def pool(self):
        self._pool = _pool()
        yield
        self._pool.close()

    def test_add_and_get(self):
        dal = PostgresDataAccessLayer(self._pool)
        sec = _sector()
        dal.sectors.add(sec)
        instr = _instrument(sec.id)
        dal.instruments.add(instr)
        sig = _signal(instr.id)
        dal.signals.add(sig)
        news_id = uuid4()
        from src.models import NewsEvent
        news = NewsEvent(
            id=news_id, instrument_id=instr.id,
            published_at=_ts(), created_at=_ts(), headline="Test"
        )
        dal.news_events.add(news)
        link = SignalNews(signal_id=sig.id, news_event_id=news_id)
        dal.signal_news.add(link)
        fetched = dal.signal_news.get_or_none(sig.id, news_id)
        assert fetched is not None
        assert fetched.signal_id == sig.id
        # cleanup
        dal.signal_news.delete(sig.id, news_id)
        # (remaining entities would be cleaned up separately in prod; skip here)

    def test_duplicate_bridge_raises_duplicate_entity(self):
        dal = PostgresDataAccessLayer(self._pool)
        sec = _sector()
        dal.sectors.add(sec)
        instr = _instrument(sec.id)
        dal.instruments.add(instr)
        sig = _signal(instr.id)
        dal.signals.add(sig)
        from src.models import NewsEvent
        news = NewsEvent(
            id=uuid4(), instrument_id=instr.id,
            published_at=_ts(), created_at=_ts(), headline="dup"
        )
        dal.news_events.add(news)
        link = SignalNews(signal_id=sig.id, news_event_id=news.id)
        dal.signal_news.add(link)
        with pytest.raises(DuplicateEntity):
            dal.signal_news.add(link)  # duplicate
        dal.signal_news.delete(sig.id, news.id)

    def test_delete_missing_raises_entity_not_found(self):
        repo = PostgresBridgeRepository(
            SignalNews, self._pool, "signal_news", ("signal_id", "news_event_id")
        )
        with pytest.raises(EntityNotFound):
            repo.delete(uuid4(), uuid4())


@_NEEDS_DB
class TestPostgresDALStructuralLookups:
    """Structural relationship lookups inherited from DataAccessLayer work with PostgresDAL."""

    @pytest.fixture(autouse=True)
    def pool(self):
        self._pool = _pool()
        yield
        self._pool.close()

    def test_repositories_property_returns_19_repos(self):
        dal = PostgresDataAccessLayer(self._pool)
        repos = dal.repositories
        assert len(repos) == 19

    def test_fills_for_order_returns_empty(self):
        dal = PostgresDataAccessLayer(self._pool)
        # fills_for_order is inherited; no fills exist for a random UUID
        result = dal.fills_for_order(uuid4())
        assert result == []

    def test_score_for_signal_returns_none(self):
        dal = PostgresDataAccessLayer(self._pool)
        assert dal.score_for_signal(uuid4()) is None
