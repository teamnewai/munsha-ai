"""THUL-NURAYN v1 — D5 Duplicate Order Protection (D5 §6).

Fingerprint = (signal_id, instrument_id, engine, direction). At most one live
order per fingerprint; replays/repeated signals are rejected as duplicates.
"""

from __future__ import annotations

from typing import Any


class DuplicateOrderProtection:
    def __init__(self) -> None:
        self._active: set[tuple] = set()

    @staticmethod
    def fingerprint(order: Any) -> tuple:
        return (order.signal_id, order.instrument_id, order.engine, order.direction)

    def is_duplicate(self, order: Any) -> bool:
        return self.fingerprint(order) in self._active

    def register(self, order: Any) -> None:
        self._active.add(self.fingerprint(order))

    def release(self, order: Any) -> None:
        self._active.discard(self.fingerprint(order))


__all__ = ["DuplicateOrderProtection"]
