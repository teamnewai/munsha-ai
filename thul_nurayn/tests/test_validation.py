"""Tests for the validation layer."""

import pytest

from thul_nurayn.validation import ValidationError, Validator
from thul_nurayn.validation.validators import (
    validate_fill,
    validate_instrument,
    validate_market_snapshot,
    validate_order,
    validate_signal,
    validate_user,
)


def test_validator_collects_multiple_errors():
    v = Validator()
    v.require("a", None)
    v.positive("b", -1)
    assert not v.ok
    assert len(v.errors) == 2
    with pytest.raises(ValidationError) as ei:
        v.raise_if_errors()
    assert len(ei.value.errors) == 2


def test_valid_user_passes():
    validate_user({"email": "a@b.com", "role": "TRADER"})


@pytest.mark.parametrize(
    "data",
    [
        {"email": None},
        {"email": "not-an-email"},
        {"email": "a@b.com", "role": "WIZARD"},
    ],
)
def test_invalid_user_raises(data):
    with pytest.raises(ValidationError):
        validate_user(data)


def test_instrument_symbol_rules():
    validate_instrument({"symbol": "AAPL", "name": "Apple"})
    with pytest.raises(ValidationError):
        validate_instrument({"symbol": "aapl too long!", "name": "x"})
    with pytest.raises(ValidationError):
        validate_instrument({"symbol": "AAPL", "name": "x", "tick_size": 0})


def test_signal_requires_valid_enums():
    validate_signal(
        {"instrument_id": "i", "engine_type": "MOMENTUM", "direction": "LONG"}
    )
    with pytest.raises(ValidationError):
        validate_signal(
            {"instrument_id": "i", "engine_type": "BOGUS", "direction": "LONG"}
        )


def test_order_quantity_must_be_positive():
    validate_order({"instrument_id": "i", "direction": "LONG", "quantity": 10})
    with pytest.raises(ValidationError):
        validate_order({"instrument_id": "i", "direction": "LONG", "quantity": 0})


def test_fill_validation():
    validate_fill({"order_id": "o", "fill_quantity": 5, "fill_price": 10.0})
    with pytest.raises(ValidationError):
        validate_fill({"order_id": "o", "fill_quantity": 5, "fill_price": -1})


def test_market_snapshot_ohlc_coherence():
    validate_market_snapshot(
        {
            "instrument_id": "i",
            "snapshot_time": "2026-01-01T00:00:00Z",
            "open": 10,
            "high": 11,
            "low": 9,
            "close": 10.5,
        }
    )
    with pytest.raises(ValidationError):
        validate_market_snapshot(
            {
                "instrument_id": "i",
                "snapshot_time": "2026-01-01T00:00:00Z",
                "open": 10,
                "high": 8,   # high < low → incoherent
                "low": 9,
                "close": 10.5,
            }
        )
