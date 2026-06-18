"""THUL-NURAYN v1 — D3 input facts & output value objects.

Inputs are PASSED-IN facts (computed elsewhere — a data provider in a later
phase). D3 only applies thresholds (D3_SELECTION_REPORT §4). These are plain,
frozen, deterministic value objects; they reuse D1 enums and add no D1/D2
changes.

Outputs: ScoredCandidate(symbol, engine, direction, score, classification,
breakdown).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional

from src.enums import Direction, EngineType, TradeClassification


# --------------------------------------------------------------------------- #
# Inputs
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class MarketFacts:
    """SPY-relative facts used to classify the market regime (Master §4)."""

    spy_price: Decimal
    spy_sma_200: Decimal
    adx: Optional[Decimal] = None  # optional; sideways tends to ADX < ~20


@dataclass(frozen=True)
class BreakoutFacts:
    """Breakout context (Master §3, §12)."""

    new_52w_high: bool = False
    base_breakout: bool = False
    base_days: int = 0  # length of base; qualifies at >= BASE_HIGH_MIN_DAYS


@dataclass(frozen=True)
class EarningsFacts:
    """PEAD context — complementary (Master §3, §7)."""

    surprise_positive: bool = False
    days_since: int = 999
    aligned: bool = False


@dataclass(frozen=True)
class CoreCandidateInput:
    """A Core-Swing candidate's passed-in facts."""

    symbol: str
    direction: Direction
    rs_rating: Decimal
    rvol: Decimal
    adv: int
    trend_stage2: bool                 # price > 50 > 150 > 200, SMA200 rising
    breakout: BreakoutFacts
    earnings: Optional[EarningsFacts] = None


@dataclass(frozen=True)
class TurboCandidateInput:
    """A Turbo-Intraday candidate's passed-in facts."""

    symbol: str
    direction: Direction
    rvol: Decimal
    adv: int
    atr: Decimal
    premarket_volume: int
    gap_pct: Decimal
    above_vwap: bool
    catalyst: bool = False
    orb_confirmed: bool = False
    momentum_ok: bool = False


# --------------------------------------------------------------------------- #
# Output
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class ScoredCandidate:
    """Deterministic selection output consumed by D4 (Risk Gate)."""

    symbol: str
    engine: EngineType
    direction: Direction
    score: Decimal
    classification: TradeClassification
    breakdown: dict = field(default_factory=dict)


__all__ = [
    "MarketFacts",
    "BreakoutFacts",
    "EarningsFacts",
    "CoreCandidateInput",
    "TurboCandidateInput",
    "ScoredCandidate",
]
