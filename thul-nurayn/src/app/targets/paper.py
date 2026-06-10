"""THUL-NURAYN v1 — D11 Paper Trading execution target.

Mode C (owner-approved): simulated execution only, **no real broker, no network**.
It DELEGATES to the existing D5 `ExecutionEngine` (create -> submit -> fill) and
only *simulates* the broker fill — the one new piece D11 is permitted. It
reimplements no execution rule: D5's state machines, validation, duplicate
protection, and position verification all run unchanged.

Owner decisions honored:
  * OD-4: immediate full fill at the SUPPLIED mark, no slippage.
  * OD-5: paper rows tagged via a `broker_ref` convention ("paper:<uuid>"),
          no schema change.
  * OD-10: orders are created only in execution modes (this one).

The target never sizes (quantity supplied) and never fetches prices (mark
supplied) — preserving the position-allocation and Portfolio ⟂ Risk ⟂ Execution
invariants.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from src.enums import OrderStatus, PositionStatus
from src.execution.requests import OrderRequest
from src.models import Fill, Position

from ..broker_mock import MockBrokerSyncContract
from .base import ExecutionIntent, ExecutionOutcome, ExecutionTarget

_NAME = "paper"
_PAPER_PREFIX = "paper:"


class PaperBrokerSyncContract(MockBrokerSyncContract):
    """A simulated, always-connected broker boundary (no network).

    Reuses the B9 in-memory `MockBrokerSyncContract` contract implementation;
    paper mode is, by definition, a connected simulator.
    """

    def __init__(self) -> None:
        super().__init__(connected=True)


class PaperTarget(ExecutionTarget):
    """Simulated execution via the existing D5 ExecutionEngine."""

    def __init__(self, execution_engine, *, clock=None) -> None:
        self._engine = execution_engine
        self._clock = clock or (lambda: datetime.now(timezone.utc))

    def name(self) -> str:
        return _NAME

    def executes(self) -> bool:
        return True

    def handle_accepted(self, intent: ExecutionIntent) -> ExecutionOutcome:
        if intent.mark is None:
            raise ValueError("paper target requires a supplied mark (OD-4)")

        now = intent.at or self._clock()
        signal = intent.signal

        # 1) create + submit via existing D5 engine (rules enforced by D5)
        request = OrderRequest(
            instrument_id=signal.instrument_id,
            user_id=intent.user_id,
            engine=signal.engine,
            direction=signal.direction,
            quantity=intent.quantity,
            signal_id=signal.id,
            broker_ref=f"{_PAPER_PREFIX}{uuid4()}",   # OD-5 paper tag, no schema change
        )
        order = self._engine.create_order(request)
        order = self._engine.submit_order(order)

        # 2) simulate the broker fill (the only new D11 logic): full fill at mark
        position = Position(
            id=uuid4(),
            instrument_id=signal.instrument_id,
            engine=signal.engine,
            direction=signal.direction,
            status=PositionStatus.OPEN,
            quantity=intent.quantity,
            opened_at=now,
            entry_price=intent.mark,
        )
        self._engine.dal.positions.add(position)

        fill = Fill(
            id=uuid4(),
            order_id=order.id,
            position_id=position.id,
            quantity=intent.quantity,
            price=intent.mark,
            filled_at=now,
        )
        # 3) apply via existing D5 engine -> SENT -> FILLED (D5 enforces correctness)
        filled = self._engine.apply_fill(order, fill, position)

        # keep the simulated broker view consistent for any later reconciliation
        broker = getattr(self._engine, "broker_sync", None)
        if isinstance(broker, MockBrokerSyncContract) and order.broker_ref:
            from src.execution.broker_sync import BrokerOrderView
            broker.seed_order_view(
                BrokerOrderView(
                    broker_ref=order.broker_ref,
                    status=OrderStatus.FILLED,
                    filled_quantity=intent.quantity,
                )
            )

        return ExecutionOutcome(
            mode=_NAME,
            executed=True,
            signal=signal,
            order=filled,
            position=position,
            fill=fill,
        )


__all__ = ["PaperTarget", "PaperBrokerSyncContract"]
