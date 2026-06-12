"""THUL-NURAYN v1 — B8 durable system-event emission.

The single primitive used by alerting, DLQ, health, and kill-switch caching to
record an operationally significant event durably in the existing append-only
`system_events` table (B8_OPERATIONS_ARCHITECTURE §11).

Uses existing `SystemEventType` / `SeverityLevel` members only — no new enum,
no new table, no schema change.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from src.enums import SeverityLevel, SystemEventType
from src.models import SystemEvent


def emit_system_event(
    dal,
    event_type: SystemEventType,
    severity: SeverityLevel,
    detail: Optional[dict] = None,
    *,
    created_at: Optional[datetime] = None,
) -> SystemEvent:
    """Append one `SystemEvent` row via the injected DataAccessLayer.

    Durable-first: the row is written before any alert dispatch. The append is
    routed by PostgreSQL to the correct monthly partition (B7); with the
    in-memory DAL it is stored directly. `system_events` is append-only.
    """
    event = SystemEvent(
        id=uuid4(),
        created_at=created_at or datetime.now(timezone.utc),
        event_type=event_type,
        severity=severity,
        detail=detail,
    )
    return dal.system_events.add(event)


__all__ = ["emit_system_event"]
