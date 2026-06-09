"""THUL-NURAYN v1 — B8 scheduler & worker contract.

Synchronous worker model (B8_OPERATIONS_ARCHITECTURE §6). Consistent with the
synchronous D2 Repository ABC and B7 drivers — no async/await, no new repository
ABC.

  * `Worker` (ABC): `name`, `interval` (seconds), `run_once()`.
  * `Scheduler`: invokes workers; a failing `run_once()` is caught, logged,
    recorded as a `WorkerFailure` system_events row, optionally dead-lettered,
    and the scheduler continues. One failing job never crashes the scheduler.
  * No automatic retry beyond the next scheduled cadence.

`run_all_once()` drives the workers synchronously (used in tests and ticks).
`start()/stop()` run a background thread loop for production.
"""

from __future__ import annotations

import threading
import time
from abc import ABC, abstractmethod
from typing import Optional

from src.enums import SeverityLevel, SystemEventType
from src.logging import get_logger

from .events import emit_system_event


class Worker(ABC):
    """A unit of recurring operational work."""

    name: str = "worker"
    interval: float = 60.0  # seconds

    @abstractmethod
    def run_once(self) -> None:
        """Perform one unit of work. Exceptions are isolated by the Scheduler."""
        ...


class Scheduler:
    """Runs workers with per-worker failure isolation."""

    def __init__(self, dal, alert_manager=None, dlq=None, logger=None) -> None:
        self._dal = dal
        self._alerts = alert_manager
        self._dlq = dlq
        self._log = logger or get_logger("thul.scheduler")
        self._workers: list[Worker] = []
        self._last_run: dict[str, float] = {}
        self._last_success: dict[str, float] = {}
        self._thread: Optional[threading.Thread] = None
        self._stop = threading.Event()

    def register(self, worker: Worker) -> None:
        self._workers.append(worker)

    @property
    def workers(self) -> tuple:
        return tuple(self._workers)

    def last_success(self, name: str) -> Optional[float]:
        return self._last_success.get(name)

    # -- synchronous drive -------------------------------------------------- #
    def run_all_once(self) -> None:
        """Run every registered worker once, isolating failures."""
        for worker in self._workers:
            self._run_worker(worker)

    def run_due(self, now: Optional[float] = None) -> None:
        """Run workers whose interval has elapsed since their last run."""
        now = now if now is not None else time.monotonic()
        for worker in self._workers:
            last = self._last_run.get(worker.name)
            if last is None or (now - last) >= worker.interval:
                self._run_worker(worker, now=now)

    def _run_worker(self, worker: Worker, now: Optional[float] = None) -> None:
        self._last_run[worker.name] = now if now is not None else time.monotonic()
        try:
            worker.run_once()
            self._last_success[worker.name] = time.monotonic()
        except Exception as exc:
            self._log.error("worker failed name=%s err=%s", worker.name, exc)
            self._record_failure(worker, exc)

    def _record_failure(self, worker: Worker, exc: Exception) -> None:
        detail = {
            "kind": "worker_failure",
            "worker": worker.name,
            "error": f"{type(exc).__name__}: {exc}",
        }
        # durable record
        if self._alerts is not None:
            self._alerts.alert(
                SystemEventType.WORKER_FAILURE, SeverityLevel.CRITICAL, detail
            )
        else:
            emit_system_event(
                self._dal, SystemEventType.WORKER_FAILURE,
                SeverityLevel.CRITICAL, detail,
            )
        # dead-letter the failed unit (manual resolution; no auto-retry)
        if self._dlq is not None:
            self._dlq.dead_letter(
                item_type=f"worker:{worker.name}",
                payload={"worker": worker.name},
                reason=f"{type(exc).__name__}: {exc}",
                correlation={"worker": worker.name},
            )

    # -- background loop (production) -------------------------------------- #
    def start(self, tick_sec: float = 1.0) -> None:
        if self._thread is not None:
            return
        self._stop.clear()

        def _loop() -> None:
            while not self._stop.is_set():
                self.run_due()
                self._stop.wait(tick_sec)

        self._thread = threading.Thread(target=_loop, name="thul-scheduler", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=5.0)
            self._thread = None


__all__ = ["Worker", "Scheduler"]
