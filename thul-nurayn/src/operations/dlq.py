"""THUL-NURAYN v1 — B8 Dead Letter Queue (DLQ).

Owner-ratified A1: the DLQ is realized on the existing append-only
`system_events` table — no new table, no new enum (B8_OPERATIONS_ARCHITECTURE §5).

  * Each dead-lettered work item is appended as a `WorkerFailure` system_events
    row whose JSONB `detail` carries the full envelope.
  * Resolution is append-only: a new `WorkerFailure` row of kind "dlq_resolution"
    references the original by id (`dlq_ref`). Current state = latest row wins.
  * PostgreSQL is the source of truth; an optional Redis index provides fast
    depth/listing and is rebuilt from the DB. Never authoritative.
  * No automatic retry — dead-lettered items are resolved manually.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from src.enums import SeverityLevel, SystemEventType
from src.logging import get_logger
from src.models import SystemEvent

from .events import emit_system_event

DLQ_KIND = "dlq"
DLQ_RESOLUTION_KIND = "dlq_resolution"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class DeadLetterQueue:
    """Durable, manually-resolved DLQ over append-only `system_events`."""

    def __init__(self, dal, redis_client=None, logger=None) -> None:
        self._dal = dal
        self._redis = redis_client
        self._log = logger or get_logger("thul.dlq")

    # -- producer ---------------------------------------------------------- #
    def dead_letter(
        self,
        item_type: str,
        payload: dict,
        reason: str,
        correlation: Optional[dict] = None,
        severity: SeverityLevel = SeverityLevel.CRITICAL,
    ) -> SystemEvent:
        """Append a dead-letter record. Returns the created SystemEvent."""
        detail = {
            "kind": DLQ_KIND,
            "item_type": item_type,
            "payload": payload,
            "reason": reason,
            "correlation": correlation or {},
            "failed_at": _now_iso(),
            "resolution": {"status": "Unresolved"},
        }
        event = emit_system_event(
            self._dal, SystemEventType.WORKER_FAILURE, severity, detail
        )
        self._index_add(event.id)
        self._log.warning(
            "dead-letter item_type=%s reason=%s id=%s", item_type, reason, event.id
        )
        return event

    # -- operator resolution (append-only) --------------------------------- #
    def resolve(
        self,
        dlq_ref: UUID,
        resolved_by: str,
        note: Optional[str] = None,
    ) -> SystemEvent:
        """Append a resolution record referencing the original dead-letter id."""
        detail = {
            "kind": DLQ_RESOLUTION_KIND,
            "dlq_ref": str(dlq_ref),
            "resolution": {
                "status": "Resolved",
                "resolved_by": resolved_by,
                "resolved_at": _now_iso(),
                "note": note,
            },
        }
        event = emit_system_event(
            self._dal, SystemEventType.WORKER_FAILURE, SeverityLevel.WARNING, detail
        )
        self._index_remove(dlq_ref)
        return event

    # -- queries (PostgreSQL = source of truth) ---------------------------- #
    def _all_worker_failures(self) -> list[SystemEvent]:
        return self._dal.system_events.list(
            event_type=SystemEventType.WORKER_FAILURE
        )

    def list_unresolved(self) -> list[SystemEvent]:
        """Dead-letter rows with no later resolution row referencing them."""
        rows = self._all_worker_failures()
        resolved_refs = {
            (r.detail or {}).get("dlq_ref")
            for r in rows
            if (r.detail or {}).get("kind") == DLQ_RESOLUTION_KIND
        }
        unresolved = [
            r
            for r in rows
            if (r.detail or {}).get("kind") == DLQ_KIND
            and str(r.id) not in resolved_refs
        ]
        unresolved.sort(key=lambda r: r.created_at)
        return unresolved

    def depth(self) -> int:
        """Number of unresolved dead-letter items (authoritative, from DB)."""
        return len(self.list_unresolved())

    def rebuild_index(self) -> int:
        """Repopulate the optional Redis index from PostgreSQL. Returns depth."""
        items = self.list_unresolved()
        if self._redis is not None and self._redis.available:
            # Index stored as a simple count cache; non-authoritative.
            self._redis.set(self._index_key(), str(len(items)))
        return len(items)

    # -- optional Redis index (non-critical) ------------------------------- #
    def _index_key(self) -> str:
        return "thul:ops:dlq:unresolved"

    def _index_add(self, _event_id: UUID) -> None:
        if self._redis is None or not self._redis.available:
            return
        try:
            self.rebuild_index()
        except Exception as exc:
            self._log.warning("dlq index update failed: %s", exc)

    def _index_remove(self, _dlq_ref: UUID) -> None:
        if self._redis is None or not self._redis.available:
            return
        try:
            self.rebuild_index()
        except Exception as exc:
            self._log.warning("dlq index update failed: %s", exc)


__all__ = ["DeadLetterQueue", "DLQ_KIND", "DLQ_RESOLUTION_KIND"]
