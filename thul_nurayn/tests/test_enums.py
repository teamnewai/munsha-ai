"""Tests for the shared enumerations."""

import pytest

from thul_nurayn.domain.enums import (
    ALL_ENUMS,
    Direction,
    OrderStatus,
    RiskDecision,
    SeverityLevel,
    UserRole,
)


def test_all_eight_enums_present():
    assert len(ALL_ENUMS) == 8


@pytest.mark.parametrize("enum_cls", ALL_ENUMS)
def test_values_are_unique_uppercase_strings(enum_cls):
    values = enum_cls.values()
    assert len(values) == len(set(values))
    for v in values:
        assert isinstance(v, str) and v == v.upper()


def test_str_returns_value():
    assert str(Direction.LONG) == "LONG"


def test_has_value():
    assert Direction.has_value("LONG")
    assert not Direction.has_value("SIDEWAYS")


def test_coerce_from_value_and_member():
    assert Direction.coerce("SHORT") is Direction.SHORT
    assert Direction.coerce(Direction.SHORT) is Direction.SHORT


def test_coerce_invalid_raises():
    with pytest.raises(ValueError):
        Direction.coerce("NOPE")


def test_order_status_terminal_flags():
    assert OrderStatus.FILLED.is_terminal
    assert OrderStatus.REJECTED.is_terminal
    assert not OrderStatus.PENDING.is_terminal
    assert not OrderStatus.PARTIALLY_FILLED.is_terminal


def test_risk_decision_failsafe_execution_gate():
    assert RiskDecision.APPROVED.allows_execution
    assert RiskDecision.ADJUSTED.allows_execution
    assert not RiskDecision.REJECTED.allows_execution
    assert not RiskDecision.PENDING.allows_execution


def test_role_and_severity_membership():
    assert "SYSTEM" in UserRole.values()
    assert SeverityLevel.values() == ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
