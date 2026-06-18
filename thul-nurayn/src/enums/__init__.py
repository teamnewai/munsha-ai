"""THUL-NURAYN v1 — D1 Foundation enumerations.

The 12 approved enumerations (8 core + 4 supporting) per D1_FOUNDATION_REPORT §6.

Member sets are transcribed from approved sources only (no invention):
  - 6 from the Master Specification:
        MarketRegime, EngineType, Direction, UserRole, TradeClassification, Market
  - 6 recovered from sibling reports (owner-approved as authoritative per
    B1_READINESS_DECISION §5a), embedded in D4/D5/D8:
        OrderStatus, PositionStatus  (D5)
        RiskDecision                 (D4)
        SeverityLevel, SystemEventType, AuditEventType  (D8)

Each enum is a `str` Enum so its members serialize to the exact spec spelling
used by the database CHECK constraints in db/migrations/001_init_schema.sql.
"""

from __future__ import annotations

from enum import Enum

__all__ = [
    "MarketRegime",
    "EngineType",
    "Direction",
    "OrderStatus",
    "PositionStatus",
    "UserRole",
    "RiskDecision",
    "SeverityLevel",
    "TradeClassification",
    "Market",
    "SystemEventType",
    "AuditEventType",
]


class MarketRegime(str, Enum):
    """Market regime — Master Specification §4."""

    BULL = "Bull"
    BEAR = "Bear"
    SIDEWAYS = "Sideways"


class EngineType(str, Enum):
    """Engine — Master Specification §1, §8 (Core Swing + Turbo Intraday)."""

    CORE = "Core"
    TURBO = "Turbo"


class Direction(str, Enum):
    """Trade direction — Master Specification §2, §12–13."""

    LONG = "Long"
    SHORT = "Short"


class OrderStatus(str, Enum):
    """Order lifecycle state — recovered from D5 §1, §4."""

    NEW = "New"
    SENT = "Sent"
    FILLED = "Filled"
    REJECTED = "Rejected"
    CANCELLED = "Cancelled"


class PositionStatus(str, Enum):
    """Position lifecycle state — recovered from D5 §1, §4."""

    OPEN = "Open"
    CLOSED = "Closed"


class UserRole(str, Enum):
    """User role — Master Specification §20."""

    OWNER = "Owner"
    OPERATOR = "Operator"
    VIEWER = "Viewer"


class RiskDecision(str, Enum):
    """Risk gate decision — recovered from D4 §3 (RiskDecisionResult)."""

    ACCEPTED = "Accepted"
    REJECTED = "Rejected"


class SeverityLevel(str, Enum):
    """Alert severity — recovered from D8 §4."""

    WARNING = "Warning"
    CRITICAL = "Critical"
    EMERGENCY = "Emergency"


class TradeClassification(str, Enum):
    """Trade classification — Master Specification §9–§11.

    Score bands (informational, applied in later domains, not enforced here):
      UltraGolden = 100 · Golden 95–99 · Strong 90–94 · Watchlist < 90.
    """

    ULTRA_GOLDEN = "UltraGolden"
    GOLDEN = "Golden"
    STRONG = "Strong"
    WATCHLIST = "Watchlist"


class Market(str, Enum):
    """Listing market — Master Specification §2."""

    NASDAQ = "NASDAQ"
    NYSE = "NYSE"


class SystemEventType(str, Enum):
    """Technical/system event types — recovered from D8 §6 and D7 §4.

    Transcribed from the explicitly named items:
      Service Start/Stop · WorkerFailure · Redis/Postgres/Gateway events ·
      KillSwitchActivated · IBGatewayReconnected.
    """

    SERVICE_STARTED = "ServiceStarted"
    SERVICE_STOPPED = "ServiceStopped"
    WORKER_FAILURE = "WorkerFailure"
    REDIS_EVENT = "RedisEvent"
    POSTGRES_EVENT = "PostgresEvent"
    GATEWAY_EVENT = "GatewayEvent"
    KILL_SWITCH_ACTIVATED = "KillSwitchActivated"
    IB_GATEWAY_RECONNECTED = "IBGatewayReconnected"


class AuditEventType(str, Enum):
    """Decision/user audit event types — recovered from D8 §6.

    Transcribed from: Login · Setting/Risk Change · Orders · Shutdown · Errors.
    """

    LOGIN = "Login"
    SETTING_RISK_CHANGE = "SettingRiskChange"
    ORDER = "Order"
    SHUTDOWN = "Shutdown"
    ERROR = "Error"
