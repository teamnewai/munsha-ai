"""THUL-NURAYN v1 — D4 Risk Decision Engine (Master §14; D4_RISK_GATE_REPORT §3).

Combines the gates: Accept ONLY if every gate passes; otherwise Reject with the
first failing gate (Kill Switch evaluated first). Any missing input / exception
⇒ Fail-Safe rejection. Accept/Reject ONLY — no order, no sizing, no execution.
"""

from __future__ import annotations

from typing import Any, Optional

from src.enums import RiskDecision

from .gates import ALL_GATES, Gate
from .state import GateResult, RiskDecisionResult, RiskState


class RiskDecisionEngine:
    def __init__(self, gates: Optional[list[Gate]] = None) -> None:
        # Kill Switch first by construction of ALL_GATES.
        self._gates = gates if gates is not None else ALL_GATES

    def evaluate(
        self, state: RiskState, candidate: Any = None
    ) -> RiskDecisionResult:
        # Fail-Safe: no state at all -> reject.
        if state is None:
            return self._fail_safe("RiskState is None")
        try:
            results = tuple(gate.evaluate(state) for gate in self._gates)
        except Exception as exc:  # any bad/missing input -> Fail-Safe reject
            return self._fail_safe(f"gate evaluation error: {exc!r}")

        rejected_by = next((g.name for g in results if not g.passed), None)
        decision = (
            RiskDecision.ACCEPTED if rejected_by is None else RiskDecision.REJECTED
        )
        return RiskDecisionResult(
            decision=decision, gates=results, rejected_by=rejected_by
        )

    @staticmethod
    def _fail_safe(reason: str) -> RiskDecisionResult:
        return RiskDecisionResult(
            decision=RiskDecision.REJECTED,
            gates=(GateResult("FailSafe", False, reason),),
            rejected_by="FailSafe",
        )


__all__ = ["RiskDecisionEngine"]
