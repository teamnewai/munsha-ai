"""THUL-NURAYN v1 — D5 Order Validation Layer (D5 §5).

Structural execution validation only (NOT risk/sizing): order integrity and
Σfills ≤ order.quantity, with each fill bound to the order.
"""

from __future__ import annotations

from typing import Iterable

from src.models import Fill, Order

from .errors import OrderValidationError


class OrderValidationLayer:
    def validate(self, order: Order) -> bool:
        if order.quantity <= 0:
            raise OrderValidationError(f"order quantity must be > 0 (got {order.quantity})")
        return True

    def validate_fills_within_order(self, order: Order, fills: Iterable[Fill]) -> bool:
        fills = list(fills)
        for f in fills:
            if f.order_id != order.id:
                raise OrderValidationError("fill.order_id does not match order.id")
        total = sum(f.quantity for f in fills)
        if total > order.quantity:
            raise OrderValidationError(
                f"sum of fills ({total}) exceeds order quantity ({order.quantity})"
            )
        return True


__all__ = ["OrderValidationLayer"]
