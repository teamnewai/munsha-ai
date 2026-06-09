"""Tests for the core domain models."""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from thul_nurayn.domain.enums import Direction, EngineType, RiskDecision
from thul_nurayn.domain.models import (
    CORE_MODELS,
    Fill,
    MarketSnapshot,
    Order,
    RiskCheck,
    Signal,
    SystemEvent,
    User,
)


def test_seventeen_core_models():
    assert len(CORE_MODELS) == 17
    # all unique
    assert len({m.__name__ for m in CORE_MODELS}) == 17


def test_user_defaults_and_serialization():
    u = User(email="trader@example.com")
    d = u.to_dict()
    assert d["email"] == "trader@example.com"
    assert d["role"] == "VIEWER"          # enum encoded to value
    assert isinstance(d["id"], str)        # uuid -> str
    assert isinstance(d["created_at"], str)  # datetime -> iso
    uuid.UUID(d["id"])  # parses
    datetime.fromisoformat(d["created_at"])  # parses


def test_signal_roundtrip_from_dict():
    sig = Signal(
        instrument_id=uuid.uuid4(),
        engine_type=EngineType.MOMENTUM,
        direction=Direction.LONG,
    )
    again = Signal.from_dict(sig.to_dict())
    assert again.engine_type == EngineType.MOMENTUM.value or again.engine_type == EngineType.MOMENTUM
    assert str(again.instrument_id) == str(sig.instrument_id)


def test_decimal_encoded_as_string():
    snap = MarketSnapshot(
        instrument_id=uuid.uuid4(),
        snapshot_time=datetime(2026, 1, 1, tzinfo=timezone.utc),
        open=Decimal("10.5"),
        high=Decimal("11.0"),
        low=Decimal("10.0"),
        close=Decimal("10.8"),
    )
    d = snap.to_dict()
    assert d["open"] == "10.5"
    assert d["regime"] == "UNKNOWN"


def test_riskcheck_failsafe_default_is_rejected():
    rc = RiskCheck(signal_id=uuid.uuid4())
    assert rc.decision is RiskDecision.REJECTED


def test_order_and_fill_construction():
    o = Order(
        instrument_id=uuid.uuid4(),
        direction=Direction.LONG,
        quantity=Decimal("100"),
    )
    f = Fill(order_id=o.id, fill_quantity=Decimal("100"), fill_price=Decimal("10.25"))
    assert f.commission == Decimal("0")
    assert f.order_id == o.id


def test_system_event_payload_default_independent():
    e1 = SystemEvent(event_type="boot", message="up")
    e2 = SystemEvent(event_type="boot", message="up")
    e1.payload["x"] = 1
    assert e2.payload == {}  # field(default_factory) → no shared mutable
