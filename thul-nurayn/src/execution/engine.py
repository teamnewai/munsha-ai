"""THUL-NURAYN v1 — D5 Execution Engine (coordinator).

Drives the order lifecycle (B5 §5) by composing the D5 components over D2
repositories: create → submit → fill → complete / cancel / reject. No broker
connectivity, no sizing, no risk, no portfolio analytics. Submission is a state
transition + a BrokerSyncContract boundary, not a network call.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from src.enums import OrderStatus
from src.models import Fill, Order, Position

from .audit_flow import AuditEventFlow
from .broker_sync import SyncReconciliation
from .duplicate import DuplicateOrderProtection
from .errors import DuplicateOrderError
from .position_verification import PositionVerification
from .requests import OrderRequest
from .state_machines import OrderStateMachine, PositionStateMachine
from .validation import OrderValidationLayer


class ExecutionEngine:
    def __init__(self, dal, broker_sync=None) -> None:
        self.dal = dal
        self.broker_sync = broker_sync
        self.order_sm = OrderStateMachine()
        self.position_sm = PositionStateMachine()
        self.validator = OrderValidationLayer()
        self.duplicates = DuplicateOrderProtection()
        self.position_verifier = PositionVerification()
        self.reconciler = SyncReconciliation()
        self.audit = AuditEventFlow(dal)

    # -- creation ---------------------------------------------------------- #
    def create_order(self, request: OrderRequest) -> Order:
        order = Order(
            id=uuid4(),
            created_at=datetime.now(timezone.utc),
            instrument_id=request.instrument_id,
            user_id=request.user_id,
            engine=request.engine,
            direction=request.direction,
            status=OrderStatus.NEW,
            quantity=request.quantity,
            signal_id=request.signal_id,
            position_id=None,
            broker_ref=request.broker_ref,
        )
        self.validator.validate(order)
        if self.duplicates.is_duplicate(order):
            self.audit.error_event(order, "duplicate order rejected")
            raise DuplicateOrderError("an active order with this fingerprint exists")
        self.dal.orders.add(order)
        self.duplicates.register(order)
        self.audit.order_event(order, "created")
        return order

    # -- submission -------------------------------------------------------- #
    def submit_order(self, order: Order) -> Order:
        new = self.order_sm.transition(order, OrderStatus.SENT)
        self.dal.orders.update(new)
        self.audit.order_event(new, "submitted")
        return new

    # -- fills ------------------------------------------------------------- #
    def apply_fill(self, order: Order, fill: Fill, position: Position) -> Order:
        self.position_verifier.verify_open(position)
        self.position_verifier.verify_matches(order, position)
        existing = self.dal.fills_for_order(order.id)
        self.validator.validate_fills_within_order(order, existing + [fill])
        self.dal.fills.add(fill)
        self.audit.order_event(order, "fill")
        total = sum(f.quantity for f in self.dal.fills_for_order(order.id))
        if total == order.quantity:
            filled = self.order_sm.transition(order, OrderStatus.FILLED)
            self.dal.orders.update(filled)
            self.duplicates.release(order)
            self.audit.order_event(filled, "filled")
            return filled
        return order

    # -- terminal transitions --------------------------------------------- #
    def cancel_order(self, order: Order) -> Order:
        new = self.order_sm.transition(order, OrderStatus.CANCELLED)
        self.dal.orders.update(new)
        self.duplicates.release(order)
        self.audit.order_event(new, "cancelled")
        return new

    def reject_order(self, order: Order, reason: str = "rejected") -> Order:
        new = self.order_sm.transition(order, OrderStatus.REJECTED)
        self.dal.orders.update(new)
        self.duplicates.release(order)
        self.audit.error_event(new, reason)
        return new


__all__ = ["ExecutionEngine"]
