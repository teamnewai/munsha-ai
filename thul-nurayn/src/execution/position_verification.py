"""THUL-NURAYN v1 — D5 Position Verification (D5 §5).

A position used for fills must be open and match the order's instrument,
engine, and direction.
"""

from __future__ import annotations

from src.enums import PositionStatus
from src.models import Order, Position

from .errors import PositionVerificationError


class PositionVerification:
    def verify_open(self, position: Position) -> bool:
        if position.status != PositionStatus.OPEN:
            raise PositionVerificationError(
                f"position {position.id} is not open (status={position.status.value})"
            )
        return True

    def verify_matches(self, order: Order, position: Position) -> bool:
        if (
            position.instrument_id != order.instrument_id
            or position.engine != order.engine
            or position.direction != order.direction
        ):
            raise PositionVerificationError(
                "position does not match order (instrument/engine/direction)"
            )
        return True


__all__ = ["PositionVerification"]
