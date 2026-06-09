"""THUL-NURAYN v1 — Shared Enumerations.

These eight enums are the canonical vocabulary shared across every layer of
the system. They are plain ``str``-backed enums so they serialize cleanly to
JSON, to PostgreSQL ``TEXT``/``ENUM`` columns, and to Redis payloads without
custom encoders.

⚠️  ASSUMPTION FLAG (see CR-001): the authoritative Master Specification was
not available. Enum *members* below are a conservative reconstruction and
must be reconciled against the spec when supplied. Adding/removing members is
a documentation correction / bug fix in v1 — not new logic.
"""

from __future__ import annotations

from enum import Enum


class _StrEnum(str, Enum):
    """A string-valued enum with stable serialization helpers."""

    def __str__(self) -> str:  # pragma: no cover - trivial
        return str(self.value)

    @classmethod
    def values(cls) -> list[str]:
        return [member.value for member in cls]

    @classmethod
    def has_value(cls, value: object) -> bool:
        return any(value == member.value for member in cls)

    @classmethod
    def coerce(cls, value: "str | _StrEnum"):
        """Return the matching member, accepting either a member or its value."""
        if isinstance(value, cls):
            return value
        for member in cls:
            if member.value == value:
                return member
        raise ValueError(f"{value!r} is not a valid {cls.__name__}")


class MarketRegime(_StrEnum):
    """Coarse classification of prevailing market conditions."""

    TRENDING_UP = "TRENDING_UP"
    TRENDING_DOWN = "TRENDING_DOWN"
    RANGE_BOUND = "RANGE_BOUND"
    HIGH_VOLATILITY = "HIGH_VOLATILITY"
    UNKNOWN = "UNKNOWN"


class EngineType(_StrEnum):
    """The scanning/signal engine that produced an artifact."""

    MOMENTUM = "MOMENTUM"
    MEAN_REVERSION = "MEAN_REVERSION"
    BREAKOUT = "BREAKOUT"
    TREND_FOLLOWING = "TREND_FOLLOWING"
    EVENT_DRIVEN = "EVENT_DRIVEN"


class Direction(_StrEnum):
    """Trade / position direction."""

    LONG = "LONG"
    SHORT = "SHORT"
    FLAT = "FLAT"


class OrderStatus(_StrEnum):
    """Lifecycle states of an order."""

    PENDING = "PENDING"
    SUBMITTED = "SUBMITTED"
    PARTIALLY_FILLED = "PARTIALLY_FILLED"
    FILLED = "FILLED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"

    @property
    def is_terminal(self) -> bool:
        return self in {
            OrderStatus.FILLED,
            OrderStatus.CANCELLED,
            OrderStatus.REJECTED,
            OrderStatus.EXPIRED,
        }


class PositionStatus(_StrEnum):
    """Lifecycle states of a position."""

    OPEN = "OPEN"
    CLOSING = "CLOSING"
    CLOSED = "CLOSED"


class UserRole(_StrEnum):
    """Authorization role of a user / actor."""

    ADMIN = "ADMIN"
    TRADER = "TRADER"
    ANALYST = "ANALYST"
    VIEWER = "VIEWER"
    SYSTEM = "SYSTEM"


class RiskDecision(_StrEnum):
    """Outcome of a risk gate evaluation.

    Fail-safe invariant: the absence of an explicit ``APPROVED`` is treated as
    not-approved. ``REJECTED`` is the conservative default.
    """

    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    ADJUSTED = "ADJUSTED"
    PENDING = "PENDING"

    @property
    def allows_execution(self) -> bool:
        return self in {RiskDecision.APPROVED, RiskDecision.ADJUSTED}


class SeverityLevel(_StrEnum):
    """Severity used by logging, system_events, news_events, audit."""

    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


ALL_ENUMS: tuple[type[_StrEnum], ...] = (
    MarketRegime,
    EngineType,
    Direction,
    OrderStatus,
    PositionStatus,
    UserRole,
    RiskDecision,
    SeverityLevel,
)

__all__ = [
    "MarketRegime",
    "EngineType",
    "Direction",
    "OrderStatus",
    "PositionStatus",
    "UserRole",
    "RiskDecision",
    "SeverityLevel",
    "ALL_ENUMS",
]
