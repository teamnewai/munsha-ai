"""THUL-NURAYN v1 — D1 Foundation domain models.

17 entity models + 2 bridge models = 19, mirroring the 19 tables in
db/migrations/001_init_schema.sql (D1_FOUNDATION_REPORT §3, §5).

Field rules (D1_FOUNDATION_REPORT §5):
  - money values        -> Decimal
  - identifiers         -> uuid.UUID
  - timestamps          -> timezone-aware datetime (UTC)
  - VIX / state         -> nullable

These are pure data structures (dataclasses). No business logic at D1.
Column-level fields were authored during B1 under owner approval
(B1_READINESS_DECISION §5b) and are recorded in D1_BUILD_REPORT.md.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

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

__all__ = [
    "Sector",
    "User",
    "Instrument",
    "MarketSnapshot",
    "ScannerResult",
    "Signal",
    "Score",
    "RiskCheck",
    "Order",
    "Position",
    "Fill",
    "RiskSnapshot",
    "NewsEvent",
    "EarningsEvent",
    "PerformanceRecord",
    "AuditLog",
    "SystemEvent",
    "SignalNews",
    "SignalEarnings",
]


# --------------------------------------------------------------------------- #
# Reference entities
# --------------------------------------------------------------------------- #
@dataclass
class Sector:
    id: UUID
    name: str
    created_at: datetime


@dataclass
class User:
    id: UUID
    username: str
    role: UserRole
    created_at: datetime
    is_active: bool = True


@dataclass
class Instrument:
    id: UUID
    symbol: str
    market: Market
    sector_id: UUID
    created_at: datetime
    is_active: bool = True


# --------------------------------------------------------------------------- #
# Selection chain
# --------------------------------------------------------------------------- #
@dataclass
class MarketSnapshot:
    id: UUID
    captured_at: datetime
    regime: MarketRegime
    spy_price: Decimal
    spy_sma_200: Decimal
    vix: Optional[Decimal] = None
    state: Optional[str] = None


@dataclass
class ScannerResult:
    id: UUID
    instrument_id: UUID
    engine: EngineType
    created_at: datetime
    market_snapshot_id: Optional[UUID] = None
    passed: bool = False
    rvol: Optional[Decimal] = None


@dataclass
class Signal:
    id: UUID
    created_at: datetime
    instrument_id: UUID
    engine: EngineType
    direction: Direction


@dataclass
class Score:
    id: UUID
    signal_id: UUID  # 1:1 with Signal
    engine: EngineType
    total: Decimal
    classification: TradeClassification
    created_at: datetime
    breakdown: dict = field(default_factory=dict)


@dataclass
class RiskCheck:
    id: UUID
    signal_id: UUID  # 1:1 with Signal
    decision: RiskDecision
    created_at: datetime
    rejected_by: Optional[str] = None


# --------------------------------------------------------------------------- #
# Execution chain
# --------------------------------------------------------------------------- #
@dataclass
class Order:
    id: UUID
    created_at: datetime
    instrument_id: UUID
    user_id: UUID
    engine: EngineType
    direction: Direction
    status: OrderStatus
    quantity: int
    signal_id: Optional[UUID] = None
    position_id: Optional[UUID] = None
    broker_ref: Optional[str] = None


@dataclass
class Position:
    id: UUID
    instrument_id: UUID
    engine: EngineType
    direction: Direction
    status: PositionStatus
    quantity: int
    opened_at: datetime
    entry_price: Optional[Decimal] = None
    exit_price: Optional[Decimal] = None
    closed_at: Optional[datetime] = None


@dataclass
class Fill:
    id: UUID
    order_id: UUID
    position_id: UUID
    quantity: int
    price: Decimal
    filled_at: datetime


# --------------------------------------------------------------------------- #
# Risk / news / earnings / performance
# --------------------------------------------------------------------------- #
@dataclass
class RiskSnapshot:
    id: UUID
    captured_at: datetime
    equity: Decimal
    high_water_mark: Decimal
    daily_drawdown: Decimal
    weekly_drawdown: Decimal
    open_positions: int
    trades_today: int
    consecutive_losses: int


@dataclass
class NewsEvent:
    id: UUID
    instrument_id: UUID
    published_at: datetime
    created_at: datetime
    headline: Optional[str] = None


@dataclass
class EarningsEvent:
    id: UUID
    instrument_id: UUID
    event_date: datetime
    created_at: datetime
    surprise: Optional[Decimal] = None


@dataclass
class PerformanceRecord:
    id: UUID
    period_type: str  # 'daily' | 'weekly' | 'monthly' (DB CHECK constraint)
    period_start: datetime
    period_end: datetime
    trades: int
    wins: int
    losses: int
    realized_pnl: Decimal
    win_rate: Decimal
    created_at: datetime


# --------------------------------------------------------------------------- #
# Append-only logs
# --------------------------------------------------------------------------- #
@dataclass
class AuditLog:
    id: UUID
    created_at: datetime
    event_type: AuditEventType
    user_id: Optional[UUID] = None
    entity_ref: Optional[UUID] = None
    detail: Optional[dict] = None


@dataclass
class SystemEvent:
    id: UUID
    created_at: datetime
    event_type: SystemEventType
    severity: SeverityLevel
    detail: Optional[dict] = None


# --------------------------------------------------------------------------- #
# Bridges (many-to-many)
# --------------------------------------------------------------------------- #
@dataclass
class SignalNews:
    signal_id: UUID
    news_event_id: UUID


@dataclass
class SignalEarnings:
    signal_id: UUID
    earnings_event_id: UUID
