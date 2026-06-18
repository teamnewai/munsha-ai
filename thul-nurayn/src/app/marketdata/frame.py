"""THUL-NURAYN v1 — P-DATA frame & data-quality value objects.

Transient value objects produced by the market-data layer and consumed by
P-ORCH (P_DATA_MARKET_DATA_ARCHITECTURE.md §8, §10). Not persisted; not D1
entities; no schema change.

A `MarketDataFrame` carries the exact D3 input DTOs (`MarketFacts`,
`CoreCandidateInput`, `TurboCandidateInput`), per-symbol marks, and a
`QualityReport`. Marks are keyed by symbol (matching candidate symbols);
symbol -> instrument_id resolution is P-ORCH's responsibility at the
persistence/execution boundary (the layer that owns the DAL).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from src.selection.facts import MarketFacts

# Data-quality issue types (string constants — NOT a new D1 enum).
MISSING_PRICE = "missing_price"
INVALID_VOLUME = "invalid_volume"
DUPLICATE_BAR = "duplicate_bar"
STALE_DATA = "stale_data"
MARKET_CLOSED = "market_closed"


@dataclass(frozen=True)
class QualityReport:
    """Outcome of data-quality validation for one frame (transient)."""

    valid: bool                       # False => P-ORCH must Reject Cycle
    fatal_issues: tuple = field(default_factory=tuple)   # tuple[str, ...]
    dropped: tuple = field(default_factory=tuple)        # tuple[(symbol, reason), ...]

    @property
    def reason(self) -> str:
        if self.valid:
            return "ok"
        return "fatal: " + ", ".join(self.fatal_issues)


@dataclass(frozen=True)
class MarketDataFrame:
    """One market-data cycle's inputs for the pipeline (transient read model)."""

    captured_at: datetime
    market_open: bool
    market_facts: Optional[MarketFacts]              # None if withheld (fatal)
    core_candidates: tuple                            # tuple[CoreCandidateInput, ...]
    turbo_candidates: tuple                           # tuple[TurboCandidateInput, ...]
    marks: dict                                       # dict[str, Decimal]  symbol->price
    quality: QualityReport
    bar_id: Optional[str] = None                      # idempotency key for duplicate detection

    @property
    def tradable(self) -> bool:
        """True only when the frame is quality-valid and the market is open."""
        return self.quality.valid and self.market_open and self.market_facts is not None


__all__ = [
    "MarketDataFrame",
    "QualityReport",
    "MISSING_PRICE",
    "INVALID_VOLUME",
    "DUPLICATE_BAR",
    "STALE_DATA",
    "MARKET_CLOSED",
]
