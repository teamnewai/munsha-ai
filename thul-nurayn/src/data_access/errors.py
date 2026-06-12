"""THUL-NURAYN v1 — D2 Data Access Layer errors.

Error hierarchy per D2_DATA_ACCESS_REPORT §2:
    DataLayerError
      ├─ EntityNotFound
      ├─ DuplicateEntity
      └─ ImmutableViolation
"""

from __future__ import annotations


class DataLayerError(Exception):
    """Base class for all data-access-layer errors."""


class EntityNotFound(DataLayerError):
    """Raised when a requested entity does not exist."""


class DuplicateEntity(DataLayerError):
    """Raised when inserting a duplicate primary or unique identifier."""


class ImmutableViolation(DataLayerError):
    """Raised when update/delete is attempted on an append-only store."""


__all__ = [
    "DataLayerError",
    "EntityNotFound",
    "DuplicateEntity",
    "ImmutableViolation",
]
