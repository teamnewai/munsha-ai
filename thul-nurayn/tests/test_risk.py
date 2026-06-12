"""B4 unit tests — D4 Risk Gate.

Covers each gate at its boundary, the decision engine (accept/reject,
first-failing-gate, kill-switch-first), and Fail-Safe behavior. Pure / offline.
"""

import unittest
from dataclasses import replace
from decimal import Decimal

from src.enums import RiskDecision
from src.risk import (
    ConsecutiveLossGate,
    DailyDrawdownGate,
    KillSwitchGate,
    KillSwitchLevel,
    MaxOpenPositionsGate,
    MaxTradesPerDayGate,
    MonthlyDrawdownGate,
    RiskDecisionEngine,
    RiskState,
    SectorExposureGate,
    WeeklyDrawdownGate,
)

D = Decimal


def clean() -> RiskState:
    """A state that passes every gate (all defaults are conservative)."""
    return RiskState()


# --------------------------------------------------------------------------- #
class TestKillSwitchGate(unittest.TestCase):
    def setUp(self):
        self.g = KillSwitchGate()

    def test_none_and_l1_pass(self):
        self.assertTrue(self.g.evaluate(replace(clean(), kill_switch_level=KillSwitchLevel.NONE)).passed)
        self.assertTrue(self.g.evaluate(replace(clean(), kill_switch_level=KillSwitchLevel.L1)).passed)

    def test_l2_l3_l4_fail(self):
        for lvl in (KillSwitchLevel.L2, KillSwitchLevel.L3, KillSwitchLevel.L4):
            self.assertFalse(self.g.evaluate(replace(clean(), kill_switch_level=lvl)).passed)


class TestBoundaryGates(unittest.TestCase):
    def test_max_open(self):
        g = MaxOpenPositionsGate()
        self.assertTrue(g.evaluate(replace(clean(), open_positions=4)).passed)
        self.assertFalse(g.evaluate(replace(clean(), open_positions=5)).passed)

    def test_max_trades(self):
        g = MaxTradesPerDayGate()
        self.assertTrue(g.evaluate(replace(clean(), trades_today=4)).passed)
        self.assertFalse(g.evaluate(replace(clean(), trades_today=5)).passed)

    def test_daily_drawdown(self):
        g = DailyDrawdownGate()
        self.assertTrue(g.evaluate(replace(clean(), daily_drawdown=D("-0.0299"))).passed)
        self.assertFalse(g.evaluate(replace(clean(), daily_drawdown=D("-0.03"))).passed)
        self.assertFalse(g.evaluate(replace(clean(), daily_drawdown=D("-0.05"))).passed)

    def test_weekly_drawdown(self):
        g = WeeklyDrawdownGate()
        self.assertTrue(g.evaluate(replace(clean(), weekly_drawdown=D("-0.05"))).passed)
        self.assertFalse(g.evaluate(replace(clean(), weekly_drawdown=D("-0.06"))).passed)

    def test_monthly_pause(self):
        g = MonthlyDrawdownGate()
        self.assertTrue(g.evaluate(replace(clean(), monthly_pause_active=False)).passed)
        self.assertFalse(g.evaluate(replace(clean(), monthly_pause_active=True)).passed)

    def test_consecutive_loss(self):
        g = ConsecutiveLossGate()
        self.assertTrue(g.evaluate(replace(clean(), consecutive_losses=2)).passed)
        self.assertFalse(g.evaluate(replace(clean(), consecutive_losses=3)).passed)

    def test_sector_exposure(self):
        g = SectorExposureGate()
        at_limit = replace(clean(), candidate_sector_current_exposure=D("0.20"),
                           candidate_sector_added_exposure=D("0.05"))
        over = replace(clean(), candidate_sector_current_exposure=D("0.20"),
                       candidate_sector_added_exposure=D("0.06"))
        self.assertTrue(g.evaluate(at_limit).passed)    # 0.25 == limit -> pass
        self.assertFalse(g.evaluate(over).passed)        # 0.26 -> fail


class TestDecisionEngine(unittest.TestCase):
    def setUp(self):
        self.engine = RiskDecisionEngine()

    def test_all_pass_accepted(self):
        r = self.engine.evaluate(clean())
        self.assertEqual(r.decision, RiskDecision.ACCEPTED)
        self.assertIsNone(r.rejected_by)
        self.assertTrue(r.accepted)
        self.assertEqual(len(r.gates), 8)
        self.assertTrue(all(g.passed for g in r.gates))

    def test_single_failure_records_gate(self):
        r = self.engine.evaluate(replace(clean(), open_positions=5))
        self.assertEqual(r.decision, RiskDecision.REJECTED)
        self.assertEqual(r.rejected_by, "MaxOpenPositions")
        self.assertFalse(r.accepted)

    def test_kill_switch_evaluated_first(self):
        # both kill switch (L2) and open positions (5) fail -> KillSwitch wins
        r = self.engine.evaluate(replace(clean(),
                                         kill_switch_level=KillSwitchLevel.L2,
                                         open_positions=5))
        self.assertEqual(r.rejected_by, "KillSwitch")

    def test_first_failing_in_order_when_killswitch_ok(self):
        # open and daily both fail; open comes first in order
        r = self.engine.evaluate(replace(clean(), open_positions=5,
                                         daily_drawdown=D("-0.10")))
        self.assertEqual(r.rejected_by, "MaxOpenPositions")

    def test_all_gates_recorded_for_transparency(self):
        r = self.engine.evaluate(replace(clean(), consecutive_losses=3))
        self.assertEqual(len(r.gates), 8)  # full transparency
        names = [g.name for g in r.gates]
        self.assertEqual(names[0], "KillSwitch")  # order preserved
        self.assertIn("ConsecutiveLoss", names)

    def test_determinism(self):
        s = replace(clean(), weekly_drawdown=D("-0.07"))
        self.assertEqual(self.engine.evaluate(s).rejected_by,
                         self.engine.evaluate(s).rejected_by)


class TestFailSafe(unittest.TestCase):
    def setUp(self):
        self.engine = RiskDecisionEngine()

    def test_none_state_rejected(self):
        r = self.engine.evaluate(None)
        self.assertEqual(r.decision, RiskDecision.REJECTED)
        self.assertEqual(r.rejected_by, "FailSafe")

    def test_bad_input_rejected(self):
        # daily_drawdown=None -> comparison raises -> Fail-Safe reject
        bad = replace(clean(), daily_drawdown=None)
        r = self.engine.evaluate(bad)
        self.assertEqual(r.decision, RiskDecision.REJECTED)
        self.assertEqual(r.rejected_by, "FailSafe")

    def test_failsafe_never_accepts(self):
        self.assertFalse(self.engine.evaluate(None).accepted)


if __name__ == "__main__":
    unittest.main()
