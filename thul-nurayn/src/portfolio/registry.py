"""THUL-NURAYN v1 — D6 Open and Closed position registries.

B6 reflects the D5 Position lifecycle; it owns no state machine.
OpenPositionsRegistry  — holds Position while PositionStatus.OPEN.
ClosedPositionsRegistry — holds Position after Open→Closed (D5 transition).
"""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from src.enums import EngineType
from src.models import Position

from .errors import PositionStateError


class OpenPositionsRegistry:
    """In-memory registry of currently open positions."""

    def __init__(self) -> None:
        self._store: dict[UUID, Position] = {}

    def add(self, position: Position) -> None:
        if position.id in self._store:
            raise PositionStateError(
                f"Position {position.id} already in open registry"
            )
        self._store[position.id] = position

    def remove(self, position_id: UUID) -> Position:
        if position_id not in self._store:
            raise PositionStateError(
                f"Position {position_id} not found in open registry"
            )
        return self._store.pop(position_id)

    def get(self, position_id: UUID) -> Position:
        if position_id not in self._store:
            raise PositionStateError(
                f"Position {position_id} not found in open registry"
            )
        return self._store[position_id]

    def list(self, engine: Optional[EngineType] = None) -> list[Position]:
        positions = list(self._store.values())
        if engine is not None:
            positions = [p for p in positions if p.engine == engine]
        return positions

    def count(self, engine: Optional[EngineType] = None) -> int:
        return len(self.list(engine=engine))


class ClosedPositionsRegistry:
    """In-memory registry of closed positions."""

    def __init__(self) -> None:
        self._store: dict[UUID, Position] = {}

    def add(self, position: Position) -> None:
        self._store[position.id] = position

    def get(self, position_id: UUID) -> Position:
        if position_id not in self._store:
            raise PositionStateError(
                f"Position {position_id} not found in closed registry"
            )
        return self._store[position_id]

    def list(self, engine: Optional[EngineType] = None) -> list[Position]:
        positions = list(self._store.values())
        if engine is not None:
            positions = [p for p in positions if p.engine == engine]
        return positions

    def count(self, engine: Optional[EngineType] = None) -> int:
        return len(self.list(engine=engine))


__all__ = ["OpenPositionsRegistry", "ClosedPositionsRegistry"]
