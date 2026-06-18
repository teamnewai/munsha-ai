"""THUL-NURAYN v1 — D5 OrderRequest (input value object).

Per B5_EXECUTION_ARCHITECTURE §2: the validated execution intent assembled
from an accepted candidate (D3) + acceptance (D4) + pre-computed quantity
(sizing is external). A transient DTO — NOT a D1 entity, table, or enum.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from src.enums import Direction, EngineType


@dataclass(frozen=True)
class OrderRequest:
    instrument_id: UUID
    user_id: UUID
    engine: EngineType
    direction: Direction
    quantity: int
    signal_id: Optional[UUID] = None
    broker_ref: Optional[str] = None


__all__ = ["OrderRequest"]
