"""B5 unit tests — D5 Execution Domain.

Covers state machines (legal/illegal/terminal), order validation, duplicate
protection, position verification, broker-sync reconciliation (matched/drift/
disconnected Fail-Safe), audit event flow, and the ExecutionEngine lifecycle
(create/submit/fill/complete/cancel/reject). Pure / offline (no broker/network).
"""

import unittest
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from src.data_access import DataAccessLayer
from src.enums import (
    AuditEventType,
    Direction,
    EngineType,
    OrderStatus,
    PositionStatus,
)
from src.execution import (
    BrokerOrderView,
    BrokerSyncContract,
    DuplicateOrderProtection,
    DuplicateOrderError,
    ExecutionEngine,
    IllegalTransition,
    OrderRequest,
    OrderStateMachine,
    OrderValidationError,
    OrderValidationLayer,
    PositionStateMachine,
    PositionVerification,
    PositionVerificationError,
    SyncReconciliation,
)
from src.models import Fill, Order, Position

NOW = datetime(2026, 6, 1, 14, 30, tzinfo=timezone.utc)


def make_order(status=OrderStatus.NEW, quantity=100, **over) -> Order:
    base = dict(
        id=uuid4(), created_at=NOW, instrument_id=uuid4(), user_id=uuid4(),
        engine=EngineType.CORE, direction=Direction.LONG, status=status,
        quantity=quantity, signal_id=uuid4(), position_id=None, broker_ref=None,
    )
    base.update(over)
    return Order(**base)


def make_position(order=None, status=PositionStatus.OPEN, **over) -> Position:
    base = dict(
        id=uuid4(),
        instrument_id=order.instrument_id if order else uuid4(),
        engine=order.engine if order else EngineType.CORE,
        direction=order.direction if order else Direction.LONG,
        status=status, quantity=100, opened_at=NOW,
    )
    base.update(over)
    return Position(**base)


def make_fill(order, position, quantity) -> Fill:
    return Fill(id=uuid4(), order_id=order.id, position_id=position.id,
                quantity=quantity, price=Decimal("10.00"), filled_at=NOW)


# --------------------------------------------------------------------------- #
class TestOrderStateMachine(unittest.TestCase):
    def setUp(self):
        self.sm = OrderStateMachine()

    def test_legal_transitions(self):
        o = make_order()
        self.assertEqual(self.sm.transition(o, OrderStatus.SENT).status, OrderStatus.SENT)
        self.assertEqual(self.sm.transition(o, OrderStatus.REJECTED).status, OrderStatus.REJECTED)
        self.assertEqual(self.sm.transition(o, OrderStatus.CANCELLED).status, OrderStatus.CANCELLED)
        sent = make_order(status=OrderStatus.SENT)
        self.assertEqual(self.sm.transition(sent, OrderStatus.FILLED).status, OrderStatus.FILLED)

    def test_new_to_filled_forbidden(self):
        with self.assertRaises(IllegalTransition):
            self.sm.transition(make_order(), OrderStatus.FILLED)

    def test_out_of_terminal_forbidden(self):
        for term in (OrderStatus.FILLED, OrderStatus.REJECTED, OrderStatus.CANCELLED):
            with self.assertRaises(IllegalTransition):
                self.sm.transition(make_order(status=term), OrderStatus.SENT)

    def test_is_terminal(self):
        self.assertTrue(self.sm.is_terminal(OrderStatus.FILLED))
        self.assertTrue(self.sm.is_terminal(OrderStatus.REJECTED))
        self.assertTrue(self.sm.is_terminal(OrderStatus.CANCELLED))
        self.assertFalse(self.sm.is_terminal(OrderStatus.NEW))
        self.assertFalse(self.sm.is_terminal(OrderStatus.SENT))

    def test_input_order_unmodified(self):
        o = make_order()
        self.sm.transition(o, OrderStatus.SENT)
        self.assertEqual(o.status, OrderStatus.NEW)  # original unchanged


class TestPositionStateMachine(unittest.TestCase):
    def setUp(self):
        self.sm = PositionStateMachine()

    def test_open_to_closed(self):
        p = make_position()
        self.assertEqual(self.sm.transition(p, PositionStatus.CLOSED).status, PositionStatus.CLOSED)

    def test_closed_to_open_forbidden(self):
        with self.assertRaises(IllegalTransition):
            self.sm.transition(make_position(status=PositionStatus.CLOSED), PositionStatus.OPEN)

    def test_is_terminal(self):
        self.assertTrue(self.sm.is_terminal(PositionStatus.CLOSED))
        self.assertFalse(self.sm.is_terminal(PositionStatus.OPEN))


class TestOrderValidation(unittest.TestCase):
    def setUp(self):
        self.v = OrderValidationLayer()

    def test_valid_quantity(self):
        self.assertTrue(self.v.validate(make_order(quantity=100)))

    def test_zero_quantity_rejected(self):
        with self.assertRaises(OrderValidationError):
            self.v.validate(make_order(quantity=0))

    def test_fills_within_qty(self):
        o = make_order(quantity=100)
        p = make_position(o)
        fills = [make_fill(o, p, 40), make_fill(o, p, 60)]
        self.assertTrue(self.v.validate_fills_within_order(o, fills))

    def test_fills_exceed_qty_rejected(self):
        o = make_order(quantity=100)
        p = make_position(o)
        fills = [make_fill(o, p, 70), make_fill(o, p, 40)]
        with self.assertRaises(OrderValidationError):
            self.v.validate_fills_within_order(o, fills)

    def test_fill_order_mismatch_rejected(self):
        o = make_order(quantity=100)
        other = make_order(quantity=100)
        p = make_position(o)
        with self.assertRaises(OrderValidationError):
            self.v.validate_fills_within_order(o, [make_fill(other, p, 10)])


class TestDuplicateProtection(unittest.TestCase):
    def setUp(self):
        self.d = DuplicateOrderProtection()

    def test_register_release_cycle(self):
        o = make_order()
        self.assertFalse(self.d.is_duplicate(o))
        self.d.register(o)
        self.assertTrue(self.d.is_duplicate(o))
        self.d.release(o)
        self.assertFalse(self.d.is_duplicate(o))

    def test_different_direction_not_duplicate(self):
        sig, inst = uuid4(), uuid4()
        o1 = make_order(signal_id=sig, instrument_id=inst, direction=Direction.LONG)
        o2 = make_order(signal_id=sig, instrument_id=inst, direction=Direction.SHORT)
        self.d.register(o1)
        self.assertFalse(self.d.is_duplicate(o2))


class TestPositionVerification(unittest.TestCase):
    def setUp(self):
        self.pv = PositionVerification()

    def test_verify_open(self):
        self.assertTrue(self.pv.verify_open(make_position()))

    def test_verify_closed_rejected(self):
        with self.assertRaises(PositionVerificationError):
            self.pv.verify_open(make_position(status=PositionStatus.CLOSED))

    def test_verify_matches(self):
        o = make_order()
        self.assertTrue(self.pv.verify_matches(o, make_position(o)))

    def test_verify_mismatch_rejected(self):
        o = make_order()
        bad = make_position(o, engine=EngineType.TURBO)
        with self.assertRaises(PositionVerificationError):
            self.pv.verify_matches(o, bad)


class TestBrokerSyncReconciliation(unittest.TestCase):
    def setUp(self):
        self.r = SyncReconciliation()

    def test_matched(self):
        o = make_order(status=OrderStatus.SENT)
        view = BrokerOrderView(broker_ref="X", status=OrderStatus.SENT)
        res = self.r.reconcile_order(o, view)
        self.assertTrue(res.matched)
        self.assertEqual(res.status, "matched")

    def test_drift_status_mismatch(self):
        o = make_order(status=OrderStatus.SENT)
        view = BrokerOrderView(broker_ref="X", status=OrderStatus.FILLED)
        res = self.r.reconcile_order(o, view)
        self.assertFalse(res.matched)
        self.assertEqual(res.status, "drift")

    def test_drift_no_broker_view(self):
        res = self.r.reconcile_order(make_order(), None)
        self.assertEqual(res.status, "drift")

    def test_disconnected_failsafe(self):
        res = self.r.reconcile_order(make_order(), None, connected=False)
        self.assertFalse(res.connected)
        self.assertEqual(res.status, "disconnected")

    def test_contract_is_abstract(self):
        with self.assertRaises(TypeError):
            BrokerSyncContract()  # cannot instantiate ABC


class TestExecutionEngineLifecycle(unittest.TestCase):
    def setUp(self):
        self.dal = DataAccessLayer()
        self.engine = ExecutionEngine(self.dal)

    def _request(self, **over) -> OrderRequest:
        base = dict(instrument_id=uuid4(), user_id=uuid4(), engine=EngineType.CORE,
                    direction=Direction.LONG, quantity=100, signal_id=uuid4())
        base.update(over)
        return OrderRequest(**base)

    def test_create_persists_new_and_audits(self):
        order = self.engine.create_order(self._request())
        self.assertEqual(order.status, OrderStatus.NEW)
        self.assertIsNotNone(self.dal.orders.get_or_none(order.id))
        logs = self.dal.audit_logs.list(event_type=AuditEventType.ORDER)
        self.assertTrue(any(log.entity_ref == order.id for log in logs))

    def test_duplicate_create_rejected(self):
        req = self._request()
        self.engine.create_order(req)
        with self.assertRaises(DuplicateOrderError):
            self.engine.create_order(req)
        # an ERROR audit event was recorded
        self.assertTrue(self.dal.audit_logs.count(event_type=AuditEventType.ERROR) >= 1)

    def test_zero_quantity_rejected(self):
        with self.assertRaises(OrderValidationError):
            self.engine.create_order(self._request(quantity=0))

    def test_submit_transitions_to_sent(self):
        order = self.engine.create_order(self._request())
        sent = self.engine.submit_order(order)
        self.assertEqual(sent.status, OrderStatus.SENT)
        self.assertEqual(self.dal.orders.get(order.id).status, OrderStatus.SENT)

    def test_partial_then_full_fill_completes(self):
        order = self.engine.create_order(self._request(quantity=100))
        sent = self.engine.submit_order(order)
        pos = make_position(sent)
        self.dal.positions.add(pos)
        after_partial = self.engine.apply_fill(sent, make_fill(sent, pos, 40), pos)
        self.assertEqual(after_partial.status, OrderStatus.SENT)  # not yet full
        filled = self.engine.apply_fill(sent, make_fill(sent, pos, 60), pos)
        self.assertEqual(filled.status, OrderStatus.FILLED)
        self.assertEqual(self.dal.orders.get(order.id).status, OrderStatus.FILLED)
        # fingerprint released after completion
        self.assertFalse(self.engine.duplicates.is_duplicate(order))

    def test_fill_exceeding_qty_rejected(self):
        order = self.engine.create_order(self._request(quantity=50))
        sent = self.engine.submit_order(order)
        pos = make_position(sent)
        self.dal.positions.add(pos)
        with self.assertRaises(OrderValidationError):
            self.engine.apply_fill(sent, make_fill(sent, pos, 60), pos)

    def test_fill_with_mismatched_position_rejected(self):
        order = self.engine.create_order(self._request())
        sent = self.engine.submit_order(order)
        bad_pos = make_position(sent, engine=EngineType.TURBO)
        self.dal.positions.add(bad_pos)
        with self.assertRaises(PositionVerificationError):
            self.engine.apply_fill(sent, make_fill(sent, bad_pos, 10), bad_pos)

    def test_cancel(self):
        order = self.engine.create_order(self._request())
        cancelled = self.engine.cancel_order(order)
        self.assertEqual(cancelled.status, OrderStatus.CANCELLED)

    def test_reject(self):
        order = self.engine.create_order(self._request())
        rejected = self.engine.reject_order(order, "safety layer")
        self.assertEqual(rejected.status, OrderStatus.REJECTED)
        self.assertTrue(self.dal.audit_logs.count(event_type=AuditEventType.ERROR) >= 1)


if __name__ == "__main__":
    unittest.main()
