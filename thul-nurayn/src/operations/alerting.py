"""THUL-NURAYN v1 — B8 alerting.

Severity-driven alerting (B8_OPERATIONS_ARCHITECTURE §4):
  * Severity vocabulary is the existing `SeverityLevel` enum — no new member.
  * Durable record FIRST: every alert writes a `system_events` row before any
    external dispatch. The durable record is authoritative.
  * `AlertDispatcher` is a B8-internal contract; `LogSinkDispatcher` is the
    default transport. External transports are operational config (owner-gated).
  * Graceful degradation: a dispatcher failure logs a WARNING and never blocks
    the system or loses the durable record. No automatic retry of dispatch.

B8 alerting REPORTS conditions; it never gates trading, changes risk state, or
decides kill-switch levels.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional, Sequence

from src.enums import SeverityLevel, SystemEventType
from src.logging import get_logger
from src.models import SystemEvent

from .events import emit_system_event


class AlertDispatcher(ABC):
    """Operational notification transport contract (not a trading API/UI)."""

    @abstractmethod
    def dispatch(self, event: SystemEvent, severity: SeverityLevel) -> bool:
        """Deliver an alert. Returns True on success; must not raise to caller."""
        ...


class LogSinkDispatcher(AlertDispatcher):
    """Default transport: emit the alert to the structured logger."""

    _LEVEL = {
        SeverityLevel.WARNING: "warning",
        SeverityLevel.CRITICAL: "error",
        SeverityLevel.EMERGENCY: "critical",
    }

    def __init__(self, logger=None) -> None:
        self._log = logger or get_logger("thul.alert")

    def dispatch(self, event: SystemEvent, severity: SeverityLevel) -> bool:
        method = getattr(self._log, self._LEVEL.get(severity, "warning"))
        method(
            "alert event_type=%s severity=%s detail=%s",
            event.event_type.value,
            severity.value,
            event.detail,
        )
        return True


class AlertManager:
    """Records a durable `system_events` row, then best-effort dispatches."""

    def __init__(
        self,
        dal,
        dispatchers: Optional[Sequence[AlertDispatcher]] = None,
        logger=None,
    ) -> None:
        self._dal = dal
        self._dispatchers: list[AlertDispatcher] = list(
            dispatchers if dispatchers is not None else [LogSinkDispatcher()]
        )
        self._log = logger or get_logger("thul.alert")

    def alert(
        self,
        event_type: SystemEventType,
        severity: SeverityLevel,
        detail: Optional[dict] = None,
    ) -> SystemEvent:
        # 1) durable record first (authoritative)
        event = emit_system_event(self._dal, event_type, severity, detail)
        # 2) best-effort dispatch (non-fatal, no retry)
        for dispatcher in self._dispatchers:
            try:
                dispatcher.dispatch(event, severity)
            except Exception as exc:  # never fatal; never lose the durable record
                self._log.warning(
                    "alert dispatch failed dispatcher=%s err=%s",
                    type(dispatcher).__name__,
                    exc,
                )
        return event


__all__ = ["AlertDispatcher", "LogSinkDispatcher", "AlertManager"]
