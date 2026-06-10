"""THUL-NURAYN v1 — D11 execution-target package.

Owner-approved scope: the execution-target abstraction + Signals Only + Paper
Trading. NOT implemented (owner-deferred / out of scope): Interactive Brokers,
TradingView outbound, multi-broker, subscription enforcement.

Purely additive integration-layer composition (placement per Owner Decision OD-2:
`src/app/targets/`). Execution targets delegate to the existing D5 ExecutionEngine;
no strategy/risk/execution/capital-recovery/allocation logic is changed; no
broker connectivity; no new tables/enums/schema; no modification to D1–D10.
"""

from .base import ExecutionIntent, ExecutionOutcome, ExecutionTarget
from .paper import PaperBrokerSyncContract, PaperTarget
from .selection import (
    IMPLEMENTED,
    NOT_IMPLEMENTED,
    make_execution_target,
    resolve_execution_target_name,
)
from .signals_only import SignalsOnlyTarget

__all__ = [
    "ExecutionTarget",
    "ExecutionIntent",
    "ExecutionOutcome",
    "SignalsOnlyTarget",
    "PaperTarget",
    "PaperBrokerSyncContract",
    "make_execution_target",
    "resolve_execution_target_name",
    "IMPLEMENTED",
    "NOT_IMPLEMENTED",
]
