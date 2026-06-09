"""THUL-NURAYN v1 — D2 validation layer.

Data-integrity validation only (no strategy/risk/execution logic):
  * entity type validation
  * filter/field-name validation against the entity's dataclass fields

Per D2_DATA_ACCESS_REPORT §4 "Filter validation": filtering on an unknown
field raises DataLayerError.
"""

from __future__ import annotations

import dataclasses
from typing import Any, Mapping

from .errors import DataLayerError


def field_names(entity_type: type) -> set[str]:
    """Return the declared dataclass field names of an entity type."""
    return {f.name for f in dataclasses.fields(entity_type)}


def validate_entity_type(entity: Any, entity_type: type) -> None:
    """Raise DataLayerError if `entity` is not an instance of `entity_type`."""
    if not isinstance(entity, entity_type):
        raise DataLayerError(
            f"Expected {entity_type.__name__}, got {type(entity).__name__}"
        )


def validate_filter_fields(entity_type: type, filters: Mapping[str, Any]) -> None:
    """Raise DataLayerError if any filter key is not a field of `entity_type`."""
    unknown = set(filters) - field_names(entity_type)
    if unknown:
        raise DataLayerError(
            f"Unknown filter field(s) for {entity_type.__name__}: {sorted(unknown)}"
        )


__all__ = ["field_names", "validate_entity_type", "validate_filter_fields"]
