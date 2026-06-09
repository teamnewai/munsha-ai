"""THUL-NURAYN v1 — Core Domain Models.

Seventeen dataclass-based domain models mirroring the durable PostgreSQL
entities. These are deliberately *persistence-agnostic*: PostgreSQL (the
source of truth) is defined by the DDL under ``thul_nurayn/db/migrations``;
these models are the in-process representation used by the application and
worker layers.

Each model derives from :class:`DomainModel`, which provides stable
``to_dict``/``from_dict`` serialization (UUIDs → str, datetimes → ISO-8601,
Decimals → str, enums → value) suitable for JSON, Redis payloads, and audit
snapshots.

⚠️  ASSUMPTION FLAG (CR-001): column shapes are a conservative reconstruction
pending the authoritative Master Specification.

Note: the junction tables ``signal_news`` and ``signal_earnings`` are
relationship tables; they are represented here by the
:class:`SignalNewsLink` / :class:`SignalEarningsLink` lightweight records.
"""

from __future__ import annotations

import uuid
from dataclasses import asdict, dataclass, field, fields
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Any, Optional

from thul_nurayn.domain.enums import (
    Direction,
    EngineType,
    MarketRegime,
    OrderStatus,
    PositionStatus,
    RiskDecision,
    SeverityLevel,
    UserRole,
)


def _new_id() -> uuid.UUID:
    return uuid.uuid4()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _encode(value: Any) -> Any:
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, dict):
        return {k: _encode(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_encode(v) for v in value]
    return value


@dataclass
class DomainModel:
    """Base providing serialization shared by all domain models."""

    def to_dict(self) -> dict[str, Any]:
        return {k: _encode(v) for k, v in asdict(self).items()}

    @classmethod
    def from_dict(cls, data: dict[str, Any]):
        kwargs: dict[str, Any] = {}
        type_hints = {f.name: f.type for f in fields(cls)}
        for name, raw in data.items():
            if name not in type_hints:
                continue
            kwargs[name] = raw
        return cls(**kwargs)


# --------------------------------------------------------------------------- #
# Reference / identity entities
# --------------------------------------------------------------------------- #
@dataclass
class User(DomainModel):
    email: str
    role: UserRole = UserRole.VIEWER
    full_name: Optional[str] = None
    is_active: bool = True
    id: uuid.UUID = field(default_factory=_new_id)
    created_at: datetime = field(default_factory=_now)
    updated_at: datetime = field(default_factory=_now)


@dataclass
class Sector(DomainModel):
    code: str
    name: str
    description: Optional[str] = None
    id: uuid.UUID = field(default_factory=_new_id)
    created_at: datetime = field(default_factory=_now)
    updated_at: datetime = field(default_factory=_now)


@dataclass
class Instrument(DomainModel):
    symbol: str
    name: str
    sector_id: Optional[uuid.UUID] = None
    exchange: Optional[str] = None
    currency: str = "USD"
    instrument_type: str = "EQUITY"
    tick_size: Decimal = Decimal("0.01")
    lot_size: int = 1
    is_active: bool = True
    id: uuid.UUID = field(default_factory=_new_id)
    created_at: datetime = field(default_factory=_now)
    updated_at: datetime = field(default_factory=_now)


# --------------------------------------------------------------------------- #
# Market data (append-only / partitioned)
# --------------------------------------------------------------------------- #
@dataclass
class MarketSnapshot(DomainModel):
    instrument_id: uuid.UUID
    snapshot_time: datetime
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: int = 0
    vwap: Optional[Decimal] = None
    regime: MarketRegime = MarketRegime.UNKNOWN
    id: uuid.UUID = field(default_factory=_new_id)
    created_at: datetime = field(default_factory=_now)


@dataclass
class ScannerResult(DomainModel):
    instrument_id: uuid.UUID
    engine_type: EngineType
    scan_time: datetime
    passed: bool = False
    metrics: dict[str, Any] = field(default_factory=dict)
    id: uuid.UUID = field(default_factory=_new_id)
    created_at: datetime = field(default_factory=_now)


# --------------------------------------------------------------------------- #
# Signal / scoring / risk-gate
# --------------------------------------------------------------------------- #
@dataclass
class Signal(DomainModel):
    instrument_id: uuid.UUID
    engine_type: EngineType
    direction: Direction
    scanner_result_id: Optional[uuid.UUID] = None
    regime: MarketRegime = MarketRegime.UNKNOWN
    generated_at: datetime = field(default_factory=_now)
    expires_at: Optional[datetime] = None
    metadata: dict[str, Any] = field(default_factory=dict)
    id: uuid.UUID = field(default_factory=_new_id)
    created_at: datetime = field(default_factory=_now)


@dataclass
class Score(DomainModel):
    signal_id: uuid.UUID
    composite_score: Decimal
    components: dict[str, Any] = field(default_factory=dict)
    scored_at: datetime = field(default_factory=_now)
    id: uuid.UUID = field(default_factory=_new_id)
    created_at: datetime = field(default_factory=_now)


@dataclass
class RiskCheck(DomainModel):
    signal_id: uuid.UUID
    decision: RiskDecision = RiskDecision.REJECTED  # fail-safe default
    reason: Optional[str] = None
    checks: dict[str, Any] = field(default_factory=dict)
    checked_at: datetime = field(default_factory=_now)
    id: uuid.UUID = field(default_factory=_new_id)
    created_at: datetime = field(default_factory=_now)


# --------------------------------------------------------------------------- #
# Execution
# --------------------------------------------------------------------------- #
@dataclass
class Order(DomainModel):
    instrument_id: uuid.UUID
    direction: Direction
    quantity: Decimal
    order_type: str = "MARKET"
    status: OrderStatus = OrderStatus.PENDING
    signal_id: Optional[uuid.UUID] = None
    user_id: Optional[uuid.UUID] = None
    limit_price: Optional[Decimal] = None
    stop_price: Optional[Decimal] = None
    broker_order_id: Optional[str] = None
    submitted_at: Optional[datetime] = None
    id: uuid.UUID = field(default_factory=_new_id)
    created_at: datetime = field(default_factory=_now)
    updated_at: datetime = field(default_factory=_now)


@dataclass
class Fill(DomainModel):
    order_id: uuid.UUID
    fill_quantity: Decimal
    fill_price: Decimal
    commission: Decimal = Decimal("0")
    broker_exec_id: Optional[str] = None
    filled_at: datetime = field(default_factory=_now)
    id: uuid.UUID = field(default_factory=_new_id)
    created_at: datetime = field(default_factory=_now)


@dataclass
class Position(DomainModel):
    instrument_id: uuid.UUID
    direction: Direction
    quantity: Decimal
    avg_entry_price: Decimal
    user_id: Optional[uuid.UUID] = None
    current_price: Optional[Decimal] = None
    unrealized_pnl: Decimal = Decimal("0")
    realized_pnl: Decimal = Decimal("0")
    status: PositionStatus = PositionStatus.OPEN
    opened_at: datetime = field(default_factory=_now)
    closed_at: Optional[datetime] = None
    id: uuid.UUID = field(default_factory=_new_id)
    created_at: datetime = field(default_factory=_now)
    updated_at: datetime = field(default_factory=_now)


# --------------------------------------------------------------------------- #
# Risk / portfolio telemetry (append-only / partitioned)
# --------------------------------------------------------------------------- #
@dataclass
class RiskSnapshot(DomainModel):
    snapshot_time: datetime
    user_id: Optional[uuid.UUID] = None
    gross_exposure: Decimal = Decimal("0")
    net_exposure: Decimal = Decimal("0")
    total_pnl: Decimal = Decimal("0")
    drawdown: Decimal = Decimal("0")
    open_positions: int = 0
    metrics: dict[str, Any] = field(default_factory=dict)
    id: uuid.UUID = field(default_factory=_new_id)
    created_at: datetime = field(default_factory=_now)


# --------------------------------------------------------------------------- #
# Intelligence
# --------------------------------------------------------------------------- #
@dataclass
class NewsEvent(DomainModel):
    headline: str
    instrument_id: Optional[uuid.UUID] = None
    body: Optional[str] = None
    source: Optional[str] = None
    url: Optional[str] = None
    sentiment: Optional[Decimal] = None
    severity: SeverityLevel = SeverityLevel.INFO
    published_at: datetime = field(default_factory=_now)
    id: uuid.UUID = field(default_factory=_new_id)
    created_at: datetime = field(default_factory=_now)


@dataclass
class EarningsEvent(DomainModel):
    instrument_id: uuid.UUID
    report_date: datetime
    fiscal_period: Optional[str] = None
    eps_estimate: Optional[Decimal] = None
    eps_actual: Optional[Decimal] = None
    revenue_estimate: Optional[Decimal] = None
    revenue_actual: Optional[Decimal] = None
    surprise_pct: Optional[Decimal] = None
    id: uuid.UUID = field(default_factory=_new_id)
    created_at: datetime = field(default_factory=_now)


@dataclass
class PerformanceRecord(DomainModel):
    period_start: datetime
    period_end: datetime
    user_id: Optional[uuid.UUID] = None
    total_return: Decimal = Decimal("0")
    sharpe: Optional[Decimal] = None
    max_drawdown: Optional[Decimal] = None
    win_rate: Optional[Decimal] = None
    num_trades: int = 0
    metrics: dict[str, Any] = field(default_factory=dict)
    id: uuid.UUID = field(default_factory=_new_id)
    created_at: datetime = field(default_factory=_now)


# --------------------------------------------------------------------------- #
# Operations (append-only / partitioned)
# --------------------------------------------------------------------------- #
@dataclass
class AuditLog(DomainModel):
    action: str
    entity_type: str
    user_id: Optional[uuid.UUID] = None
    entity_id: Optional[uuid.UUID] = None
    before: Optional[dict[str, Any]] = None
    after: Optional[dict[str, Any]] = None
    ip_address: Optional[str] = None
    id: uuid.UUID = field(default_factory=_new_id)
    created_at: datetime = field(default_factory=_now)


@dataclass
class SystemEvent(DomainModel):
    event_type: str
    message: str
    severity: SeverityLevel = SeverityLevel.INFO
    source: Optional[str] = None
    payload: dict[str, Any] = field(default_factory=dict)
    id: uuid.UUID = field(default_factory=_new_id)
    created_at: datetime = field(default_factory=_now)


# --------------------------------------------------------------------------- #
# Junction / relationship records
# --------------------------------------------------------------------------- #
@dataclass
class SignalNewsLink(DomainModel):
    signal_id: uuid.UUID
    news_event_id: uuid.UUID
    relevance: Optional[Decimal] = None
    created_at: datetime = field(default_factory=_now)


@dataclass
class SignalEarningsLink(DomainModel):
    signal_id: uuid.UUID
    earnings_event_id: uuid.UUID
    created_at: datetime = field(default_factory=_now)


CORE_MODELS: tuple[type[DomainModel], ...] = (
    User,
    Sector,
    Instrument,
    MarketSnapshot,
    ScannerResult,
    Signal,
    Score,
    RiskCheck,
    Order,
    Fill,
    Position,
    RiskSnapshot,
    NewsEvent,
    EarningsEvent,
    PerformanceRecord,
    AuditLog,
    SystemEvent,
)

__all__ = [m.__name__ for m in CORE_MODELS] + [
    "DomainModel",
    "SignalNewsLink",
    "SignalEarningsLink",
    "CORE_MODELS",
]
