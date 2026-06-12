"""THUL-NURAYN v1 — D5 Order & Position state machines (Master §20).

Legal transitions only; any other transition raises IllegalTransition.
States reuse D1 enums (OrderStatus / PositionStatus) — no new enums.
Pure: transitions return a new entity instance (D1 entity unmodified in place).
"""

from __future__ import annotations

from dataclasses import replace

from src.enums import OrderStatus, PositionStatus
from src.models import Order, Position

from .errors import IllegalTransition


class OrderStateMachine:
    # Required path to fill: New -> Sent -> Filled. (New -> Filled forbidden.)
    _T: dict = {
        OrderStatus.NEW: {OrderStatus.SENT, OrderStatus.REJECTED, OrderStatus.CANCELLED},
        OrderStatus.SENT: {OrderStatus.FILLED, OrderStatus.REJECTED, OrderStatus.CANCELLED},
        OrderStatus.FILLED: set(),
        OrderStatus.REJECTED: set(),
        OrderStatus.CANCELLED: set(),
    }

    def can_transition(self, frm: OrderStatus, to: OrderStatus) -> bool:
        return to in self._T.get(frm, set())

    def is_terminal(self, status: OrderStatus) -> bool:
        return len(self._T.get(status, set())) == 0

    def transition(self, order: Order, to: OrderStatus) -> Order:
        if not self.can_transition(order.status, to):
            raise IllegalTransition(
                f"Order {order.status.value} -> {to.value} is not allowed"
            )
        return replace(order, status=to)


class PositionStateMachine:
    _T: dict = {
        PositionStatus.OPEN: {PositionStatus.CLOSED},
        PositionStatus.CLOSED: set(),
    }

    def can_transition(self, frm: PositionStatus, to: PositionStatus) -> bool:
        return to in self._T.get(frm, set())

    def is_terminal(self, status: PositionStatus) -> bool:
        return len(self._T.get(status, set())) == 0

    def transition(self, position: Position, to: PositionStatus) -> Position:
        if not self.can_transition(position.status, to):
            raise IllegalTransition(
                f"Position {position.status.value} -> {to.value} is not allowed"
            )
        return replace(position, status=to)


__all__ = ["OrderStateMachine", "PositionStateMachine"]
