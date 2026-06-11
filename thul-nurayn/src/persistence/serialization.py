"""THUL-NURAYN v1 — B7 entity serialization.

Converts D1 dataclasses to SQL-compatible dicts (and back), covering:
  UUID       -> psycopg2 uuid (register_uuid ensures round-trip)
  Decimal    -> numeric (psycopg2 handles natively)
  datetime   -> timestamptz (psycopg2 handles natively, timezone-aware UTC)
  Enum       -> .value str (matches DB CHECK constraints)
  bool/int   -> pass-through
  Optional   -> None -> NULL
  dict/JSONB -> psycopg2.extras.Json wrapper for insertion; dict on retrieval

D1 entity field names equal SQL column names exactly (B7_ARCHITECTURE_SUMMARY §10,
assumption 4); no name-mapping layer is needed.
"""

from __future__ import annotations

import dataclasses
import json
import typing
from decimal import Decimal
from enum import Enum
from typing import Any

import psycopg2.extras


def _json_default(obj: Any) -> Any:
    """JSON fallback for values psycopg2's default encoder can't handle.

    Decimal -> str (exact, lossless) so JSONB fields carrying Decimal values
    (e.g. a Score.breakdown of component scores) serialize correctly. Other
    unsupported types raise (no silent data loss).
    """
    if isinstance(obj, Decimal):
        return str(obj)
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def _json_dumps(value: Any) -> str:
    return json.dumps(value, default=_json_default)


def _unwrap_optional(hint: Any) -> Any:
    """Return the inner type of Optional[X], or hint if not Optional."""
    if typing.get_origin(hint) is typing.Union:
        args = [a for a in typing.get_args(hint) if a is not type(None)]
        return args[0] if args else hint
    return hint


def serialize_value(value: Any) -> Any:
    """Convert one Python value to its psycopg2-compatible form."""
    if value is None:
        return None
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, dict):
        return psycopg2.extras.Json(value, dumps=_json_dumps)
    return value


def entity_to_row(entity: Any) -> dict[str, Any]:
    """Serialize a D1 dataclass to {column: sql_value} dict."""
    return {
        f.name: serialize_value(getattr(entity, f.name))
        for f in dataclasses.fields(entity)
    }


def row_to_entity(entity_type: type, row: dict[str, Any]) -> Any:
    """Deserialize a psycopg2 RealDictRow to a D1 dataclass instance."""
    hints = typing.get_type_hints(entity_type)
    kwargs: dict[str, Any] = {}
    for f in dataclasses.fields(entity_type):
        value = row.get(f.name)
        if value is None:
            kwargs[f.name] = None
        else:
            target = _unwrap_optional(hints[f.name])
            if isinstance(target, type) and issubclass(target, Enum):
                kwargs[f.name] = target(value)
            else:
                kwargs[f.name] = value
    return entity_type(**kwargs)


__all__ = ["serialize_value", "entity_to_row", "row_to_entity"]
