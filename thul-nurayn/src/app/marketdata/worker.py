"""THUL-NURAYN v1 — P-DATA refresh worker.

A B8 `Worker` that polls a `MarketDataProvider` each cycle and exposes the
latest `MarketDataFrame` for P-ORCH to consume (P_DATA_MARKET_DATA_ARCHITECTURE.md
§10). It makes NO engine calls (no D3/D4/D5/D6) — it only produces inputs.

On a fatal data-quality frame it records a durable operational event + DLQ entry
(via the existing B8 helpers) and continues; it never fabricates data and never
blocks. Marks may be cached in Redis (non-authoritative); failures are ignored.
PostgreSQL remains the sole source of truth.
"""

from __future__ import annotations

from typing import Optional

from src.operations.scheduler import Worker

from .frame import MarketDataFrame
from .provider import MarketDataProvider


class MarketDataRefreshWorker(Worker):
    """Polls the provider, publishes the latest frame, flags fatal quality issues."""

    name = "market_data_refresh"

    def __init__(
        self,
        provider: MarketDataProvider,
        *,
        interval: float = 60.0,
        alert_manager=None,
        dlq=None,
        redis_client=None,
        marks_cache_key: str = "thul:marketdata:marks",
    ) -> None:
        self.interval = interval
        self._provider = provider
        self._alerts = alert_manager
        self._dlq = dlq
        self._redis = redis_client
        self._marks_key = marks_cache_key
        self.last_frame: Optional[MarketDataFrame] = None

    def run_once(self) -> None:
        if self._provider.exhausted():
            return  # finite replay finished; nothing to do
        frame = self._provider.poll()
        self.last_frame = frame
        self._cache_marks(frame)
        if not frame.quality.valid:
            self._record_bad_frame(frame)

    # -- non-authoritative Redis mark cache (optional) -------------------- #
    def _cache_marks(self, frame: MarketDataFrame) -> None:
        if self._redis is None or not getattr(self._redis, "available", False):
            return
        try:
            payload = ";".join(f"{s}={p}" for s, p in frame.marks.items())
            self._redis.set(self._marks_key, payload)
        except Exception:
            pass  # cache is non-critical; never fatal

    # -- operational record on a fatal frame (alert + DLQ; non-fatal) ----- #
    def _record_bad_frame(self, frame: MarketDataFrame) -> None:
        detail = {
            "kind": "market_data_quality",
            "captured_at": frame.captured_at.isoformat(),
            "bar_id": frame.bar_id,
            "fatal_issues": list(frame.quality.fatal_issues),
            "dropped": [list(d) for d in frame.quality.dropped],
        }
        if self._alerts is not None:
            from src.enums import SeverityLevel, SystemEventType
            self._alerts.alert(
                SystemEventType.GATEWAY_EVENT, SeverityLevel.WARNING, detail
            )
        if self._dlq is not None:
            self._dlq.dead_letter(
                item_type="market_data:frame",
                payload={"bar_id": frame.bar_id},
                reason="fatal data-quality: " + ", ".join(frame.quality.fatal_issues),
                correlation={"bar_id": frame.bar_id},
            )


__all__ = ["MarketDataRefreshWorker"]
