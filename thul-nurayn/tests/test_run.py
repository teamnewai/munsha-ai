"""THUL-NURAYN v1 — OR-1 composition-entrypoint tests (always-run, in-memory).

Verifies: compose() wires existing components only; NOT started until explicit
start(); paper-only enforcement; abort paths (bad env / non-paper target /
missing fixtures / PG-unreachable via failing bootstrap); fixture loading;
smoke run (one full cycle through the composed app); startup-path,
shutdown-path, and recovery-path verification. No broker, no network.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

import pytest

from src.data_access.dal import DataAccessLayer
from src.enums import (
    Direction,
    EngineType,
    Market,
    OrderStatus,
    PositionStatus,
    SystemEventType,
)
from src.models import Instrument, Sector
from src.app.bootstrap import build_application
from src.app.orchestrator import TradingCycleWorker
from src.app.run import (
    ENV_FIXTURES,
    ENV_OPERATOR,
    compose,
    load_fixtures,
    main,
)
from src.app.sizing import CapitalSettings

_UTC = timezone.utc
_CAP = Decimal("100000")


def _now() -> datetime:
    return datetime(2026, 6, 10, 14, 30, tzinfo=_UTC)


def _seed_instrument(dal, symbol="AAPL") -> Instrument:
    sec = Sector(id=uuid4(), name=f"S-{uuid4().hex[:6]}", created_at=_now())
    dal.sectors.add(sec)
    inst = Instrument(id=uuid4(), symbol=symbol, market=Market.NASDAQ,
                      sector_id=sec.id, created_at=_now())
    dal.instruments.add(inst)
    return inst


def _fixture_spec(symbol="AAPL"):
    return {
        "captured_at": _now().isoformat(),
        "market_open": True,
        "market_facts": {"spy_price": "500", "spy_sma_200": "470", "adx": "25"},
        "core": [{
            "symbol": symbol, "direction": "Long",
            "rs_rating": "95", "rvol": "2.5", "adv": 1_000_000,
            "trend_stage2": True,
            "breakout": {"new_52w_high": True, "base_breakout": True, "base_days": 60},
            "earnings": {"surprise_positive": True, "days_since": 3, "aligned": True},
        }],
        "turbo": [],
        "marks": {symbol: "150.00"},
    }


def _settings() -> CapitalSettings:
    return CapitalSettings(capital=_CAP, allocation_fraction=Decimal("0.10"))


def _compose(dal, **over):
    from src.app.targets.selection import make_execution_target
    app = over.pop("application", None) or build_application(dal, starting_capital=_CAP)
    defaults = dict(
        application=app,
        fixtures=[_fixture_spec()],
        capital_settings=_settings(),
        execution_target=make_execution_target("paper", dal=dal),
        operator_user_id=uuid4(),
        clock=_now,
        interval=1.0,
    )
    defaults.update(over)
    return compose(**defaults)


# --------------------------------------------------------------------------- #
# Composition wiring + explicit start (startup-path verification)
# --------------------------------------------------------------------------- #

class TestCompose:
    def test_returns_composed_not_started_application(self):
        dal = DataAccessLayer()
        _seed_instrument(dal)
        app = _compose(dal)
        # trading worker registered with the existing B8 scheduler
        assert any(isinstance(w, TradingCycleWorker) for w in app.scheduler.workers)
        # NOT started (explicit start only, B9 OD-D6)
        assert app._started is False

    def test_recovery_ran_via_bootstrap(self):
        # recovery-path verification: compose() consumes the B9-recovered app
        dal = DataAccessLayer()
        inst = _seed_instrument(dal)
        from src.models import Order
        dal.orders.add(Order(id=uuid4(), created_at=_now(), instrument_id=inst.id,
                             user_id=uuid4(), engine=EngineType.CORE,
                             direction=Direction.LONG, status=OrderStatus.SENT,
                             quantity=10, signal_id=uuid4()))
        app = _compose(dal)
        assert app.recovery.in_flight_orders == 1   # fingerprint re-registered
        assert app.kill_switch_cache.current_level() == 0

    def test_paper_target_default_from_env(self, monkeypatch):
        monkeypatch.setenv("EXECUTION_TARGET", "paper")
        dal = DataAccessLayer()
        _seed_instrument(dal)
        app = _compose(dal, execution_target=None)  # force env-driven path
        assert any(isinstance(w, TradingCycleWorker) for w in app.scheduler.workers)


# --------------------------------------------------------------------------- #
# Abort paths (error handling)
# --------------------------------------------------------------------------- #

class TestAbortPaths:
    def test_non_paper_target_aborts(self, monkeypatch):
        monkeypatch.setenv("EXECUTION_TARGET", "ibkr")
        dal = DataAccessLayer()
        with pytest.raises(NotImplementedError):
            _compose(dal, execution_target=None)

    def test_missing_fixtures_env_aborts(self, monkeypatch):
        monkeypatch.delenv(ENV_FIXTURES, raising=False)
        dal = DataAccessLayer()
        with pytest.raises(ValueError):
            _compose(dal, fixtures=None)

    def test_missing_operator_env_aborts(self, monkeypatch):
        monkeypatch.delenv(ENV_OPERATOR, raising=False)
        dal = DataAccessLayer()
        with pytest.raises(ValueError):
            _compose(dal, operator_user_id=None)

    def test_bad_operator_uuid_aborts(self, monkeypatch):
        monkeypatch.setenv(ENV_OPERATOR, "not-a-uuid")
        dal = DataAccessLayer()
        with pytest.raises(ValueError):
            _compose(dal, operator_user_id=None)

    def test_invalid_capital_env_aborts(self, monkeypatch):
        monkeypatch.setenv("STARTING_CAPITAL", "NaN")
        monkeypatch.setenv("POSITION_ALLOCATION_FRACTION", "0.10")
        dal = DataAccessLayer()
        with pytest.raises(ValueError):
            _compose(dal, capital_settings=None)

    def test_pg_unreachable_aborts(self, monkeypatch):
        # production path: bootstrap() raises PersistenceError when PG is down
        from src.persistence.errors import PersistenceError

        def _boom(**kw):
            raise PersistenceError("PostgreSQL unreachable")

        monkeypatch.setattr("src.app.run.bootstrap", _boom)
        with pytest.raises(PersistenceError):
            compose(fixtures=[_fixture_spec()],
                    capital_settings=_settings(),
                    operator_user_id=uuid4())


# --------------------------------------------------------------------------- #
# Fixture loading
# --------------------------------------------------------------------------- #

class TestLoadFixtures:
    def test_loads_json_list(self, tmp_path):
        p = tmp_path / "f.json"
        p.write_text(json.dumps([_fixture_spec()]))
        specs = load_fixtures(str(p))
        assert isinstance(specs, list) and specs[0]["market_open"] is True

    def test_missing_file_aborts(self):
        with pytest.raises(ValueError):
            load_fixtures("/nonexistent/fixtures.json")

    def test_non_list_aborts(self, tmp_path):
        p = tmp_path / "bad.json"
        p.write_text(json.dumps({"not": "a list"}))
        with pytest.raises(ValueError):
            load_fixtures(str(p))

    def test_env_fixture_path_used_by_compose(self, tmp_path, monkeypatch):
        p = tmp_path / "f.json"
        p.write_text(json.dumps([_fixture_spec()]))
        monkeypatch.setenv(ENV_FIXTURES, str(p))
        dal = DataAccessLayer()
        _seed_instrument(dal)
        app = _compose(dal, fixtures=None)
        assert any(isinstance(w, TradingCycleWorker) for w in app.scheduler.workers)


# --------------------------------------------------------------------------- #
# Smoke test: one full autonomous cycle through the composed app
# --------------------------------------------------------------------------- #

class TestSmoke:
    def test_one_cycle_end_to_end(self):
        dal = DataAccessLayer()
        _seed_instrument(dal, "AAPL")
        app = _compose(dal)
        # drive the registered workers synchronously (no thread needed)
        app.scheduler.run_all_once()
        worker = next(w for w in app.scheduler.workers
                      if isinstance(w, TradingCycleWorker))
        assert worker.last_result is not None
        assert worker.last_result.executed == 1
        assert dal.orders.count(status=OrderStatus.FILLED) == 1
        assert dal.positions.count(status=PositionStatus.OPEN) == 1
        order = dal.orders.list(status=OrderStatus.FILLED)[0]
        assert order.broker_ref.startswith("paper:")   # paper only

    def test_start_and_shutdown_lifecycle(self):
        # startup + shutdown path verification (explicit start; graceful stop)
        dal = DataAccessLayer()
        _seed_instrument(dal, "AAPL")
        app = _compose(dal, interval=3600.0)
        app.start(tick_sec=3600.0)        # explicit operator start
        assert app._started is True
        app.shutdown()                    # graceful: stop scheduler + ServiceStopped
        assert app._started is False
        assert dal.system_events.count(
            event_type=SystemEventType.SERVICE_STOPPED) == 1

    def test_main_without_start_flag_does_not_start(self, tmp_path, monkeypatch):
        # main() composes only (dry-compose) unless --start is passed
        p = tmp_path / "f.json"
        p.write_text(json.dumps([_fixture_spec()]))
        monkeypatch.setenv(ENV_FIXTURES, str(p))
        monkeypatch.setenv(ENV_OPERATOR, str(uuid4()))
        monkeypatch.setenv("STARTING_CAPITAL", "100000")
        monkeypatch.setenv("POSITION_ALLOCATION_FRACTION", "0.10")
        monkeypatch.setenv("EXECUTION_TARGET", "paper")
        dal = DataAccessLayer()
        _seed_instrument(dal)
        app = build_application(dal, starting_capital=_CAP)
        monkeypatch.setattr("src.app.run.bootstrap", lambda **kw: app)
        rc = main([])                      # no --start
        assert rc == 0
        assert app._started is False       # never auto-started


# --------------------------------------------------------------------------- #
# Reuse-only guarantee
# --------------------------------------------------------------------------- #

class TestReuseOnly:
    def test_run_module_has_no_forbidden_imports(self):
        import src.app.run as mod
        src = open(mod.__file__).read().lower()
        for forbidden in ("import requests", "import socket", "urllib",
                          "ib_insync", "yfinance", "polygon",
                          "from src.selection.engine", "from src.risk.engine",
                          "from src.execution.engine"):
            assert forbidden not in src
