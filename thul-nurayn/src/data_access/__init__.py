"""THUL-NURAYN v1 — D2 Data Access Layer.

Storage and retrieval only (D2_DATA_ACCESS_REPORT). No Scanner / Strategy /
Score / Risk / Portfolio / Execution / Broker logic. 100% offline:
no PostgreSQL, Redis, FastAPI, broker, or external APIs at this phase.
"""

from __future__ import annotations

from .dal import DataAccessLayer
from .errors import (
    DataLayerError,
    DuplicateEntity,
    EntityNotFound,
    ImmutableViolation,
)
from .repository import BridgeRepository, InMemoryRepository, Repository

__all__ = [
    "DataAccessLayer",
    "Repository",
    "InMemoryRepository",
    "BridgeRepository",
    "DataLayerError",
    "EntityNotFound",
    "DuplicateEntity",
    "ImmutableViolation",
]
