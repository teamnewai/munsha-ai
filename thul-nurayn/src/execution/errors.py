"""THUL-NURAYN v1 — D5 execution-domain errors.

Exception classes only (no new entities/enums). Every illegal/invalid path
raises explicitly — no silent state changes (D5_EXECUTION_DOMAIN_REPORT §6).
"""

from __future__ import annotations


class ExecutionError(Exception):
    """Base class for execution-domain errors."""


class IllegalTransition(ExecutionError):
    """Raised on any state transition not explicitly allowed."""


class OrderValidationError(ExecutionError):
    """Raised when an order or its fills fail validation (e.g. Σfills > qty)."""


class DuplicateOrderError(ExecutionError):
    """Raised when an order with an active fingerprint already exists."""


class PositionVerificationError(ExecutionError):
    """Raised when a position is not open / does not match the order."""


class BrokerDisconnected(ExecutionError):
    """Raised/flagged when the broker sync contract reports no connection."""


__all__ = [
    "ExecutionError",
    "IllegalTransition",
    "OrderValidationError",
    "DuplicateOrderError",
    "PositionVerificationError",
    "BrokerDisconnected",
]
