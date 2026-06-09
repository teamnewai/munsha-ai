"""THUL-NURAYN v1 — D5 Audit Event Flow (D5 §9).

Converts execution events to append-only AuditLog records via D2 (add only).
Reuses D1 AuditLog entity + AuditEventType enum (ORDER / ERROR) — no new
entities/enums. audit_logs are append-only (D2 enforces immutability).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from src.enums import AuditEventType
from src.models import AuditLog, Order


class AuditEventFlow:
    def __init__(self, dal) -> None:
        self._dal = dal

    def order_event(self, order: Order, action: str) -> AuditLog:
        log = AuditLog(
            id=uuid4(),
            created_at=datetime.now(timezone.utc),
            event_type=AuditEventType.ORDER,
            user_id=getattr(order, "user_id", None),
            entity_ref=order.id,
            detail={"action": action, "status": order.status.value},
        )
        return self._dal.audit_logs.add(log)

    def error_event(self, order: Optional[Order], reason: str) -> AuditLog:
        log = AuditLog(
            id=uuid4(),
            created_at=datetime.now(timezone.utc),
            event_type=AuditEventType.ERROR,
            user_id=getattr(order, "user_id", None) if order is not None else None,
            entity_ref=order.id if order is not None else None,
            detail={"reason": reason},
        )
        return self._dal.audit_logs.add(log)


__all__ = ["AuditEventFlow"]
