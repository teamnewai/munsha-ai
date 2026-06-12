"""THUL-NURAYN v1 — D11 execution-target mode selection.

Config-driven selection of the active target (D11_EXECUTION_TARGETS_ARCHITECTURE
§7; Owner Decisions OD-1, OD-3, OD-8). One active target per process.

  * `EXECUTION_TARGET` env var (default "signals", Owner Decision OD-1).
  * Implemented modes (owner-approved scope): "signals", "paper".
  * Out-of-scope modes ("ibkr", "tradingview", multi-broker) raise
    NotImplementedError — explicitly NOT implemented in D11.

No new D1 enum: the mode is a plain config string (same pattern as B8 operational
states and D10 mode mapping).
"""

from __future__ import annotations

import os
from typing import Optional

from .base import ExecutionTarget
from .paper import PaperBrokerSyncContract, PaperTarget
from .signals_only import SignalsOnlyTarget

_DEFAULT = "signals"
IMPLEMENTED = ("signals", "paper")
# Recognized but intentionally NOT implemented in D11 (owner-deferred / out of scope).
NOT_IMPLEMENTED = ("ibkr", "tradingview")


def resolve_execution_target_name(name: Optional[str] = None) -> str:
    """Resolve and validate the requested mode. Default 'signals' (OD-1)."""
    resolved = (name or os.environ.get("EXECUTION_TARGET") or _DEFAULT).strip().lower()
    if resolved in IMPLEMENTED:
        return resolved
    if resolved in NOT_IMPLEMENTED:
        raise NotImplementedError(
            f"execution target '{resolved}' is recognized but NOT implemented in D11 "
            f"(owner-gated/out of scope); implemented: {IMPLEMENTED}"
        )
    raise ValueError(f"unknown execution target '{resolved}'; implemented: {IMPLEMENTED}")


def make_execution_target(
    name: Optional[str] = None,
    *,
    dal=None,
    execution_engine=None,
    clock=None,
) -> ExecutionTarget:
    """Construct the active execution target (one per process).

    'signals' -> SignalsOnlyTarget (no broker).
    'paper'   -> PaperTarget over the existing D5 ExecutionEngine (+ paper broker).
                 Provide `execution_engine` (preferred — reuses the wired engine)
                 or `dal` (a fresh engine with a paper broker is built).
    """
    resolved = resolve_execution_target_name(name)

    if resolved == "signals":
        return SignalsOnlyTarget()

    # resolved == "paper"
    if execution_engine is None:
        if dal is None:
            raise ValueError("paper target requires `execution_engine` or `dal`")
        from src.execution.engine import ExecutionEngine
        execution_engine = ExecutionEngine(dal, broker_sync=PaperBrokerSyncContract())
    return PaperTarget(execution_engine, clock=clock)


__all__ = [
    "resolve_execution_target_name",
    "make_execution_target",
    "IMPLEMENTED",
    "NOT_IMPLEMENTED",
]
