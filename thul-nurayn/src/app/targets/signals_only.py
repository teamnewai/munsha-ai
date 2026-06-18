"""THUL-NURAYN v1 — D11 Signals Only execution target.

Mode A (owner-approved default): D3 scores -> D4 gates -> on accept, the `Signal`
is the output. **No order is created. No broker. No execution.** Stops at the
signal (Owner Decision OD-10).

This target adds no domain logic; it acknowledges the accepted signal and returns
a non-executed outcome. The signal's persistence/lifecycle is owned upstream
(D3/pipeline); this target does not create orders or touch a broker.
"""

from __future__ import annotations

from .base import ExecutionIntent, ExecutionOutcome, ExecutionTarget

_NAME = "signals"


class SignalsOnlyTarget(ExecutionTarget):
    """Records/acknowledges the accepted signal; never executes (OD-1, OD-10)."""

    def name(self) -> str:
        return _NAME

    def executes(self) -> bool:
        return False

    def handle_accepted(self, intent: ExecutionIntent) -> ExecutionOutcome:
        # No order, no broker — the signal is the artifact (alerts-only mode).
        return ExecutionOutcome(
            mode=_NAME,
            executed=False,
            signal=intent.signal,
        )


__all__ = ["SignalsOnlyTarget"]
