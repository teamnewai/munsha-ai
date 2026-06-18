"""THUL-NURAYN v1 — P-DATA market-data & mark-ingestion layer.

Provider-independent, decision-free input layer for the pipeline
(P_DATA_MARKET_DATA_ARCHITECTURE.md). Produces the exact frozen D3 input DTOs
(`MarketFacts`, `CoreCandidateInput`, `TurboCandidateInput`) plus per-symbol
marks and a data-quality report, as a transient `MarketDataFrame` consumed by
P-ORCH. Makes NO engine calls; performs NO trading decision; PostgreSQL remains
the sole source of truth; marks are non-authoritative.

First cut: Replay/Fixture provider only (deterministic, no network). No live
vendor, no broker, no TradingView, no IBKR.
"""

from .frame import (
    DUPLICATE_BAR,
    INVALID_VOLUME,
    MARKET_CLOSED,
    MISSING_PRICE,
    STALE_DATA,
    MarketDataFrame,
    QualityReport,
)
from .provider import MarketDataProvider
from .replay import ReplayMarketDataProvider
from .worker import MarketDataRefreshWorker

__all__ = [
    "MarketDataProvider",
    "ReplayMarketDataProvider",
    "MarketDataRefreshWorker",
    "MarketDataFrame",
    "QualityReport",
    "MISSING_PRICE",
    "INVALID_VOLUME",
    "DUPLICATE_BAR",
    "STALE_DATA",
    "MARKET_CLOSED",
]
