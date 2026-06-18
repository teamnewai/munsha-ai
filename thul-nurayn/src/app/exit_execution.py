"""THUL-NURAYN v1 — EX-2 position-close execution (additive; reuses D5).

Executes a position CLOSE by composing the EXISTING D5 `ExecutionEngine` public
methods (`create_order` → `submit_order` → `apply_fill`) plus the existing
`PositionStateMachine` OPEN→CLOSED transition. It edits NO frozen D5 file: the
close is assembled from already-approved primitives, exactly as `PaperTarget`
assembles the open.

Mechanics:
  * The closing order carries the SAME instrument / engine / direction as the
    position — D5 `PositionVerification.verify_matches` requires the order's
    direction to equal the position's, so a same-direction closing order is the
    only one `apply_fill` accepts. `signal_id` is None (no D3 signal for an exit;
    the `orders.signal_id` column is nullable). `broker_ref` uses the existing
    `paper:` convention (OD-5, no schema change).
  * The exit fills at the SUPPLIED mark (OD-4, no slippage) — the actual market
    price, honoring the ratified gap-through-stop-fills-at-actual-price rule.
  * After the closing order reaches FILLED, the position is transitioned
    OPEN→CLOSED (legal per the state machine), stamped with `exit_price` and
    `closed_at` (previously-null fields — forward write, no history rewrite), and
    persisted via `dal.positions.update`.

Pure of strategy/risk/sizing: it neither decides to close (EX-1) nor reflects
portfolio state (D6 `close_position`, done by the caller). Fail-safe: an unusable
mark or a non-open position yields a non-executed `CloseOutcome` (never raises
for those); genuine D5 errors propagate to the caller for per-position isolation.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from src.enums import PositionStatus
from src.execution.requests import OrderRequest
from src.models import Fill, Order, Position

_PAPER_PREFIX = "paper:"
_ZERO = Decimal("0")


@dataclass(frozen=True)
class CloseOutcome:
    """Result of a close attempt (transient; not persisted)."""

    closed: bool
    position: Position           # the CLOSED position on success; the input otherwise
    order: Optional[Order] = None
    fill: Optional[Fill] = None
    reason: str = "ok"


def close_position(
    engine,
    position: Position,
    exit_mark: Optional[Decimal],
    user_id: UUID,
    *,
    at: Optional[datetime] = None,
) -> CloseOutcome:
    """Close one open position at `exit_mark` via the existing D5 engine."""
    now = at or datetime.now(timezone.utc)

    if position.status != PositionStatus.OPEN:
        return CloseOutcome(closed=False, position=position, reason="not_open")
    if (
        exit_mark is None
        or not isinstance(exit_mark, Decimal)
        or not exit_mark.is_finite()
        or exit_mark <= _ZERO
    ):
        return CloseOutcome(closed=False, position=position, reason="invalid_mark")

    # 1) closing order: same instrument/engine/direction (verify_matches), no signal.
    request = OrderRequest(
        instrument_id=position.instrument_id,
        user_id=user_id,
        engine=position.engine,
        direction=position.direction,
        quantity=position.quantity,
        signal_id=None,
        broker_ref=f"{_PAPER_PREFIX}{uuid4()}",
    )
    order = engine.create_order(request)
    order = engine.submit_order(order)

    # 2) simulate the closing fill at the supplied mark (full fill, no slippage).
    fill = Fill(
        id=uuid4(),
        order_id=order.id,
        position_id=position.id,
        quantity=position.quantity,
        price=exit_mark,
        filled_at=now,
    )
    filled = engine.apply_fill(order, fill, position)  # -> SENT->FILLED; verifies OPEN/match
    filled = replace(filled, position_id=position.id)  # link order *-1 position
    engine.dal.orders.update(filled)

    # 3) close the position (legal OPEN->CLOSED) + stamp exit fields + persist.
    transitioned = engine.position_sm.transition(position, PositionStatus.CLOSED)
    closed = replace(transitioned, exit_price=exit_mark, closed_at=now)
    engine.dal.positions.update(closed)

    return CloseOutcome(closed=True, position=closed, order=filled, fill=fill)


__all__ = ["CloseOutcome", "close_position"]
