"""THUL-NURAYN v1 — B7 persistence infrastructure errors."""

from __future__ import annotations


class PersistenceError(Exception):
    """Raised for infrastructure failures: DB unreachable, pool exhausted,
    serialization failure, or any unrecoverable storage-layer error."""


__all__ = ["PersistenceError"]
