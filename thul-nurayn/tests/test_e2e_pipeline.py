"""THUL-NURAYN v1 — B9 end-to-end pipeline test (in-memory backend).

Exercises the wired Application across Signal-intent → Risk decision → Execution
(create/submit/fill) → Position → Portfolio reflection → snapshot, using the
in-memory DAL and the mock broker. No network, no strategy/risk/sizing change —
only the existing engines driven through the B9 composition.

A PostgreSQL-backed variant of this scenario is gated behind DATABASE_URL and
skipped when unset (consistent with B7/B8 test strategy).
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

import pytest

from src.data_access.dal import DataAccessLayer
from src.enums import (
    Direction,
    EngineType,
    OrderStatus,
    PositionStatus,
    RiskDecision,
)
from src.execution.requests import OrderRequest
from src.models import Fill, Position
from src.risk.state import KillSwitchLevel

from src.app.bootstrap import build_application

_UTC = timezone.utc
_CAP = Decimal("100000")

_NEEDS_DB = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="DATABASE_URL not set — PostgreSQL-backed E2E requires a live database",
)


def _ts():
    return datetime.now(_UTC)


class TestE2EPipelineInMemory:
    def _app(self):
        return build_application(DataAccessLayer(), starting_capital=_CAP)

    def test_risk_accepts_clean_state(self):
        app = self._app()
        state = app.risk_state_builder.build()
        result = app.risk_engine.evaluate(state)
        assert result.decision is RiskDecision.ACCEPTED
        assert result.accepted is True

    def test_risk_rejects_when_kill_switch_blocks(self):
        app = self._app()
        # Operator/D4 records L4; B9 only relays the recorded level into RiskState.
        app.kill_switch_cache.record(level=int(KillSwitchLevel.L4))
        state = app.risk_state_builder.build()
        result = app.risk_engine.evaluate(state)
        assert result.decision is RiskDecision.REJECTED

    def test_full_order_to_portfolio_flow(self):
        app = self._app()
        dal = app.dal
        ee = app.execution_engine

        instrument_id = uuid4()
        user_id = uuid4()

        # 1) create + submit order (execution rules unchanged)
        order = ee.create_order(OrderRequest(
            instrument_id=instrument_id, user_id=user_id,
            engine=EngineType.CORE, direction=Direction.LONG,
            quantity=100, signal_id=uuid4(),
        ))
        assert order.status is OrderStatus.NEW
        order = ee.submit_order(order)
        assert order.status is OrderStatus.SENT

        # 2) open a position and fully fill the order
        position = Position(
            id=uuid4(), instrument_id=instrument_id, engine=EngineType.CORE,
            direction=Direction.LONG, status=PositionStatus.OPEN, quantity=100,
            opened_at=_ts(), entry_price=Decimal("10"),
        )
        dal.positions.add(position)
        fill = Fill(
            id=uuid4(), order_id=order.id, position_id=position.id,
            quantity=100, price=Decimal("10"), filled_at=_ts(),
        )
        order = ee.apply_fill(order, fill, position)
        assert order.status is OrderStatus.FILLED

        # 3) reflect the open position into the portfolio and snapshot
        app.portfolio_state.open_position(position)
        snap = app.portfolio_state.snapshot({instrument_id: Decimal("12")})
        # unrealized = (12-10)*100 = 200; equity = cash + 200
        assert snap.open_positions == 1
        assert snap.unrealized_pnl == Decimal("200")
        assert snap.equity == _CAP + Decimal("200")

    def test_duplicate_order_blocked_after_recovery(self):
        # in-flight order persisted -> rebuilt protection blocks the duplicate
        dal = DataAccessLayer()
        instrument_id, user_id, signal_id = uuid4(), uuid4(), uuid4()
        from src.models import Order
        existing = Order(
            id=uuid4(), created_at=_ts(), instrument_id=instrument_id,
            user_id=user_id, engine=EngineType.CORE, direction=Direction.LONG,
            status=OrderStatus.SENT, quantity=100, signal_id=signal_id,
        )
        dal.orders.add(existing)
        app = build_application(dal, starting_capital=_CAP)
        # a new order with the same fingerprint must be rejected as duplicate
        from src.execution.errors import DuplicateOrderError
        with pytest.raises(DuplicateOrderError):
            app.execution_engine.create_order(OrderRequest(
                instrument_id=instrument_id, user_id=user_id,
                engine=EngineType.CORE, direction=Direction.LONG,
                quantity=100, signal_id=signal_id,
            ))


@_NEEDS_DB
class TestE2EPipelinePostgres:
    """PostgreSQL-backed E2E; runs only when DATABASE_URL is set."""

    def test_bootstrap_against_real_db(self):
        from src.app.bootstrap import bootstrap
        os.environ.setdefault("STARTING_CAPITAL", "100000")
        app = bootstrap()
        try:
            assert app._started is False
            report = app.health_monitor.check()
            assert report.ready is True
        finally:
            app.shutdown()
