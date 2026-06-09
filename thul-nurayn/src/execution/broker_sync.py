"""THUL-NURAYN v1 — D5 Broker Synchronization contract (D5 §5; B5 §8).

CONTRACT ONLY — no adapter, no IBKR, no API calls, no networking. The concrete
implementation is D7. Broker views and the reconciliation result are transient
contract DTOs (not D1 entities/enums). Reconciliation is Fail-Safe on
drift/disconnection.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from src.enums import OrderStatus, PositionStatus
from src.models import Order

# Reconciliation outcome labels (string constants — not a new enum).
MATCHED = "matched"
DRIFT = "drift"
DISCONNECTED = "disconnected"


@dataclass(frozen=True)
class BrokerOrderView:
    broker_ref: str
    status: OrderStatus
    filled_quantity: int = 0


@dataclass(frozen=True)
class BrokerPositionView:
    instrument_id: UUID
    quantity: int
    status: PositionStatus


@dataclass(frozen=True)
class ReconciliationResult:
    matched: bool
    connected: bool
    reason: str = ""

    @property
    def status(self) -> str:
        if not self.connected:
            return DISCONNECTED
        return MATCHED if self.matched else DRIFT


class BrokerSyncContract(ABC):
    """Abstract read/sync contract. No implementation here (D7 provides it)."""

    @abstractmethod
    def is_connected(self) -> bool: ...

    @abstractmethod
    def fetch_order_view(self, broker_ref: str) -> Optional[BrokerOrderView]: ...

    @abstractmethod
    def fetch_open_positions(self) -> list[BrokerPositionView]: ...


class SyncReconciliation:
    """Compares internal state to a broker view; Fail-Safe on drift/disconnect."""

    def reconcile_order(
        self,
        internal_order: Order,
        broker_view: Optional[BrokerOrderView],
        connected: bool = True,
    ) -> ReconciliationResult:
        if not connected:
            return ReconciliationResult(False, False, "broker disconnected")
        if broker_view is None:
            return ReconciliationResult(False, True, "drift: no broker view for order")
        if broker_view.status == internal_order.status:
            return ReconciliationResult(True, True, MATCHED)
        return ReconciliationResult(
            False, True,
            f"drift: internal={internal_order.status.value} "
            f"broker={broker_view.status.value}",
        )


__all__ = [
    "MATCHED",
    "DRIFT",
    "DISCONNECTED",
    "BrokerOrderView",
    "BrokerPositionView",
    "ReconciliationResult",
    "BrokerSyncContract",
    "SyncReconciliation",
]
