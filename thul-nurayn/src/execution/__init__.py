"""THUL-NURAYN v1 — D5 Execution Domain.

Internal execution-domain behavior only (B5_EXECUTION_ARCHITECTURE): order &
position state machines, order validation, duplicate protection, position
verification, the abstract BrokerSyncContract + reconciliation, audit event
flow, and an ExecutionEngine coordinator over D2.

Risk ⟂ Execution: runs only on accepted orders. No broker connectivity, no
sizing, no risk, no portfolio analytics, no API/UI. Reuses D1 entities/enums
and D2 repositories; D1/D2/D3/D4 unmodified. 100% offline.
"""

from __future__ import annotations

from .audit_flow import AuditEventFlow
from .broker_sync import (
    DISCONNECTED,
    DRIFT,
    MATCHED,
    BrokerOrderView,
    BrokerPositionView,
    BrokerSyncContract,
    ReconciliationResult,
    SyncReconciliation,
)
from .duplicate import DuplicateOrderProtection
from .engine import ExecutionEngine
from .errors import (
    BrokerDisconnected,
    DuplicateOrderError,
    ExecutionError,
    IllegalTransition,
    OrderValidationError,
    PositionVerificationError,
)
from .position_verification import PositionVerification
from .requests import OrderRequest
from .state_machines import OrderStateMachine, PositionStateMachine
from .validation import OrderValidationLayer

__all__ = [
    "ExecutionEngine",
    "OrderRequest",
    "OrderStateMachine",
    "PositionStateMachine",
    "OrderValidationLayer",
    "DuplicateOrderProtection",
    "PositionVerification",
    "AuditEventFlow",
    "BrokerSyncContract",
    "SyncReconciliation",
    "BrokerOrderView",
    "BrokerPositionView",
    "ReconciliationResult",
    "MATCHED",
    "DRIFT",
    "DISCONNECTED",
    "ExecutionError",
    "IllegalTransition",
    "OrderValidationError",
    "DuplicateOrderError",
    "PositionVerificationError",
    "BrokerDisconnected",
]
