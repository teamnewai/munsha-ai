"""THUL-NURAYN v1 — P-DATA provider-independent contract.

`MarketDataProvider` is the vendor-independent seam (analogous to D5's
`BrokerSyncContract`). Consumers (the refresh worker, and later P-ORCH) depend
only on this ABC and the frozen D3 fact DTOs — never on a vendor
(P_DATA_MARKET_DATA_ARCHITECTURE.md §3, §11).

First-cut implementation is the Replay/Fixture provider (deterministic, no
network, no live vendor). A live vendor adapter is a FUTURE additive
implementation behind this same ABC (owner-gated; not implemented here).
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from .frame import MarketDataFrame


class MarketDataProvider(ABC):
    """Produces one validated `MarketDataFrame` per poll. Provider-independent."""

    @abstractmethod
    def poll(self) -> MarketDataFrame:
        """Return the next market-data frame (facts + candidates + marks + quality)."""
        ...

    @abstractmethod
    def exhausted(self) -> bool:
        """True when a finite replay source has no more frames (live providers: False)."""
        ...


__all__ = ["MarketDataProvider"]
