"""THUL-NURAYN v1 — D11 execution-target abstraction (base contract).

Defines the `ExecutionTarget` seam: the policy that decides *what happens to a
risk-accepted candidate* — record a signal, or execute (paper/live) — WITHOUT
changing any domain logic (D11_EXECUTION_TARGETS_ARCHITECTURE §5, §6).

Scope (owner-approved): abstraction + Signals Only + Paper. Execution targets
DELEGATE to the existing D5 `ExecutionEngine`; they reimplement no strategy,
risk, execution, capital-recovery, or sizing logic. Quantity and mark are
SUPPLIED to the target (it never sizes and never fetches prices).

`ExecutionIntent` / `ExecutionOutcome` are transient value objects — not D1
entities, not persisted, no schema change.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from src.models import Fill, Order, Position, Signal


@dataclass(frozen=True)
class ExecutionIntent:
    """A risk-accepted candidate handed to an execution target.

    `quantity` is determined upstream by the existing (fixed) allocation
    methodology — the target NEVER sizes. `mark` is supplied by the caller —
    the target NEVER fetches prices (no market data, no broker).
    """

    signal: Signal
    user_id: UUID
    quantity: int
    mark: Optional[Decimal] = None          # required by execution targets only
    at: Optional[datetime] = None           # caller-supplied time (determinism)


@dataclass(frozen=True)
class ExecutionOutcome:
    """Result of handling an accepted candidate (transient read model)."""

    mode: str
    executed: bool
    signal: Signal
    order: Optional[Order] = None
    position: Optional[Position] = None
    fill: Optional[Fill] = None


class ExecutionTarget(ABC):
    """Where/whether a risk-accepted candidate is acted upon. One active per process."""

    @abstractmethod
    def name(self) -> str:
        """Mode label (e.g. 'signals' | 'paper'). A config string, not a D1 enum."""
        ...

    @abstractmethod
    def executes(self) -> bool:
        """True if this target creates orders / touches a broker."""
        ...

    def startup_check(self) -> bool:
        """Mode-specific readiness. Default: ready (no external dependency)."""
        return True

    @abstractmethod
    def handle_accepted(self, intent: ExecutionIntent) -> ExecutionOutcome:
        """Act on a candidate already accepted by D4. Never decides risk/score/size."""
        ...

    def handle_close(
        self,
        position: Position,
        mark: Optional[Decimal],
        *,
        user_id: UUID,
        at: Optional[datetime] = None,
    ) -> Optional[Position]:
        """Close an open position at the supplied mark (EX-3).

        Returns the CLOSED position on success, or None for non-executing targets
        (Signals-Only never opened a real position, so there is nothing to close).
        Default: no-op. Executing targets (Paper) override this.
        """
        return None

    def shutdown(self) -> None:
        """Graceful teardown. Default: no-op."""
        return None


__all__ = ["ExecutionTarget", "ExecutionIntent", "ExecutionOutcome"]
