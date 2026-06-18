"""THUL-NURAYN v1 — OR-1 composition entrypoint (run module).

The runnable composition root (COMPOSITION_ENTRYPOINT_ARCHITECTURE.md). Wiring +
lifecycle ONLY: it constructs existing approved components and registers the
trading worker with the scheduler. It adds no strategy/risk/execution/feature
logic and modifies no prior layer.

  compose() -> Application   (composed + recovered, NOT started)
    bootstrap() [B9]  → Application (engines + ops + DAL + recovery)
    make_execution_target("paper"|env) [D11]   (ibkr/tradingview -> NotImplementedError)
    SizingPolicy + CapitalSettings.from_env()  [P-SIZE]
    ReplayMarketDataProvider(fixtures)         [P-DATA]  (deterministic; no vendor)
    PipelineOrchestrator.from_application(...) [P-ORCH]
    TradingCycleWorker → app.scheduler.register(worker)   [registered, NOT started]

The autonomous loop begins ONLY on the operator's explicit `application.start()`
(B9 OD-D6). Shutdown/recovery are B9's (`Application.shutdown()` / `bootstrap()`
recovery) — not reimplemented here. No broker, no TradingView, no IBKR, no live.
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime
from typing import Callable, Optional, Sequence
from uuid import UUID

from src.logging import configure_logging, get_logger

from .bootstrap import Application, bootstrap
from .marketdata import ReplayMarketDataProvider
from .orchestrator import PipelineOrchestrator, TradingCycleWorker
from .sizing import CapitalSettings, SizingPolicy
from .targets.selection import make_execution_target

# Entrypoint configuration (env; no secrets — paths/ids/intervals only).
ENV_FIXTURES = "MARKET_DATA_FIXTURES"          # path to a JSON list of frame specs
ENV_OPERATOR = "OPERATOR_USER_ID"              # UUID of the seeded operator user
ENV_CYCLE_INTERVAL = "TRADING_CYCLE_INTERVAL_SEC"
ENV_MAX_AGE = "MARKET_DATA_MAX_AGE_SEC"

_DEFAULT_INTERVAL = 60.0


def load_fixtures(path: str) -> list:
    """Load the Replay provider's frame specs from a JSON file.

    Aborts (raises ValueError) on a missing/unreadable/malformed file — no
    fabricated data, no silent fallback.
    """
    if not path or not os.path.isfile(path):
        raise ValueError(f"fixture file not found: {path!r} ({ENV_FIXTURES})")
    try:
        with open(path, encoding="utf-8") as fh:
            specs = json.load(fh)
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"unreadable fixture file {path!r}: {exc}") from exc
    if not isinstance(specs, list):
        raise ValueError(f"fixture file {path!r} must contain a JSON list of frame specs")
    return specs


def _operator_user_id() -> UUID:
    raw = os.environ.get(ENV_OPERATOR)
    if raw in (None, ""):
        raise ValueError(f"{ENV_OPERATOR} is not set (seeded operator user required)")
    try:
        return UUID(str(raw))
    except (ValueError, AttributeError, TypeError) as exc:
        raise ValueError(f"{ENV_OPERATOR} is not a valid UUID: {raw!r}") from exc


def compose(
    *,
    application: Optional[Application] = None,
    fixtures: Optional[Sequence[dict]] = None,
    capital_settings: Optional[CapitalSettings] = None,
    execution_target=None,
    operator_user_id: Optional[UUID] = None,
    clock: Optional[Callable[[], datetime]] = None,
    interval: Optional[float] = None,
    max_age_sec: Optional[float] = None,
) -> Application:
    """Compose the runnable paper-trading application (NOT started).

    Production path: every argument defaults from the environment / bootstrap()
    (health-gated: aborts if PostgreSQL is unreachable). Keyword injection exists
    only so tests can wire the in-memory Application — no behavior differs.
    """
    configure_logging()
    log = get_logger("thul.run")

    # [1] B9 application (health-gated bootstrap + recovery) — or injected.
    app = application if application is not None else bootstrap()

    # [2] Owner capital/allocation (fail-fast on missing/invalid/non-finite).
    capital = capital_settings if capital_settings is not None else CapitalSettings.from_env()

    # [3] Execution target — env-driven; paper/signals only (D11 raises for
    #     ibkr/tradingview). No broker, no live.
    target = (
        execution_target
        if execution_target is not None
        else make_execution_target(dal=app.dal)
    )

    # [4] Deterministic Replay provider (fixtures from env path unless injected).
    if fixtures is None:
        fixtures = load_fixtures(os.environ.get(ENV_FIXTURES, ""))
    if max_age_sec is None:
        raw = os.environ.get(ENV_MAX_AGE)
        if raw:
            max_age_sec = float(raw)
    provider = ReplayMarketDataProvider(
        list(fixtures), clock=clock, max_age_sec=max_age_sec
    )

    # [5] Conductor (P-ORCH) over the recovered application.
    orchestrator = PipelineOrchestrator.from_application(
        app,
        execution_target=target,
        sizing_policy=SizingPolicy(),
        capital_settings=capital,
        operator_user_id=(
            operator_user_id if operator_user_id is not None else _operator_user_id()
        ),
        clock=clock,
    )

    # [6] Register the trading worker — DO NOT start (explicit start only).
    if interval is None:
        raw = os.environ.get(ENV_CYCLE_INTERVAL)
        interval = float(raw) if raw else _DEFAULT_INTERVAL
    worker = TradingCycleWorker(orchestrator, provider, interval=interval)
    app.scheduler.register(worker)

    log.info(
        "composed target=%s fixtures=%s interval=%ss (awaiting explicit start())",
        target.name(), len(list(fixtures)), interval,
    )
    return app


def main(argv: Optional[Sequence[str]] = None) -> int:
    """Minimal operator entrypoint: compose; start ONLY on explicit --start.

    Without --start it verifies composition (dry-compose) and exits 0 — the
    loop never auto-starts (B9 OD-D6).
    """
    args = list(argv if argv is not None else [])
    app = compose()
    log = get_logger("thul.run")
    if "--start" not in args:
        log.info("composition verified; not started (pass --start to begin the loop)")
        return 0
    app.start()
    log.info("autonomous paper loop started (Ctrl+C for graceful shutdown)")
    try:
        while True:
            time.sleep(1.0)
    except KeyboardInterrupt:
        pass
    finally:
        app.shutdown()
        log.info("shutdown complete")
    return 0


if __name__ == "__main__":  # pragma: no cover - thin operator shim
    import sys

    raise SystemExit(main(sys.argv[1:]))


__all__ = ["compose", "main", "load_fixtures",
           "ENV_FIXTURES", "ENV_OPERATOR", "ENV_CYCLE_INTERVAL", "ENV_MAX_AGE"]
