"""THUL-NURAYN v1 — B9 in-memory mock broker (D3/owner ratification).

Implements the D5 `BrokerSyncContract` (ABC) with an in-memory double for
end-to-end verification. **No network, no IBKR/TradingView, no D7.** Real broker
adapters remain owner-gated (B9_INTEGRATION_ARCHITECTURE §2, §16; Owner Decision D3).

This is wiring/test infrastructure only — it adds no domain logic and changes no
execution rule. It simply returns whatever broker views the test/operator seeds.
"""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from src.execution.broker_sync import (
    BrokerOrderView,
    BrokerPositionView,
    BrokerSyncContract,
)


class MockBrokerSyncContract(BrokerSyncContract):
    """In-memory `BrokerSyncContract`. Seeded by the caller; no I/O."""

    def __init__(self, connected: bool = True) -> None:
        self._connected = connected
        self._order_views: dict[str, BrokerOrderView] = {}
        self._open_positions: list[BrokerPositionView] = []

    # -- seeding helpers (test/operator only; not part of the contract) ----- #
    def set_connected(self, connected: bool) -> None:
        self._connected = connected

    def seed_order_view(self, view: BrokerOrderView) -> None:
        self._order_views[view.broker_ref] = view

    def seed_open_positions(self, views: list[BrokerPositionView]) -> None:
        self._open_positions = list(views)

    # -- BrokerSyncContract ------------------------------------------------- #
    def is_connected(self) -> bool:
        return self._connected

    def fetch_order_view(self, broker_ref: str) -> Optional[BrokerOrderView]:
        return self._order_views.get(broker_ref)

    def fetch_open_positions(self) -> list[BrokerPositionView]:
        return list(self._open_positions)


__all__ = ["MockBrokerSyncContract"]
