"""THUL-NURAYN v1 — P-DATA tests (always-run, deterministic).

Covers the Replay/Fixture provider, D3 fact-DTO parity, marks, the five
data-quality failure types, the refresh worker, provider-independence, and the
no-engine-call guarantee. No network, no live vendor, no broker.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from src.data_access.dal import DataAccessLayer
from src.enums import Direction, SystemEventType
from src.operations.alerting import AlertManager
from src.operations.dlq import DeadLetterQueue
from src.selection.facts import (
    CoreCandidateInput,
    MarketFacts,
    TurboCandidateInput,
)
from src.app.marketdata import (
    DUPLICATE_BAR,
    INVALID_VOLUME,
    MARKET_CLOSED,
    MISSING_PRICE,
    STALE_DATA,
    MarketDataFrame,
    MarketDataProvider,
    MarketDataRefreshWorker,
    ReplayMarketDataProvider,
)

_UTC = timezone.utc


def _now() -> datetime:
    return datetime(2026, 6, 10, 14, 30, tzinfo=_UTC)


def _core_spec(symbol="AAPL", direction="Long", adv=1_000_000):
    return {
        "symbol": symbol, "direction": direction,
        "rs_rating": "90", "rvol": "2.0", "adv": adv, "trend_stage2": True,
        "breakout": {"new_52w_high": True, "base_breakout": True, "base_days": 60},
        "earnings": {"surprise_positive": True, "days_since": 3, "aligned": True},
    }


def _turbo_spec(symbol="TSLA", direction="Long", adv=2_000_000, premkt=200_000):
    return {
        "symbol": symbol, "direction": direction,
        "rvol": "3.5", "adv": adv, "atr": "1.20", "premarket_volume": premkt,
        "gap_pct": "5.0", "above_vwap": True, "catalyst": True,
        "orb_confirmed": True, "momentum_ok": True,
    }


def _spec(**over):
    base = {
        "captured_at": _now(),
        "market_open": True,
        "market_facts": {"spy_price": "500", "spy_sma_200": "470", "adx": "25"},
        "core": [_core_spec()],
        "turbo": [_turbo_spec()],
        "marks": {"AAPL": "150.00", "TSLA": "250.00"},
    }
    base.update(over)
    return base


def _provider(specs, **kw):
    return ReplayMarketDataProvider(specs, clock=_now, **kw)


# --------------------------------------------------------------------------- #
# Provider contract & fact-DTO parity
# --------------------------------------------------------------------------- #

class TestProviderAndParity:
    def test_provider_is_abstract(self):
        with pytest.raises(TypeError):
            MarketDataProvider()  # cannot instantiate ABC

    def test_replay_emits_exact_d3_dtos(self):
        frame = _provider([_spec()]).poll()
        assert isinstance(frame, MarketDataFrame)
        assert isinstance(frame.market_facts, MarketFacts)
        assert frame.market_facts.spy_price == Decimal("500")
        c = frame.core_candidates[0]
        assert isinstance(c, CoreCandidateInput)
        assert c.symbol == "AAPL" and c.direction is Direction.LONG
        assert c.rs_rating == Decimal("90") and c.adv == 1_000_000
        assert c.breakout.base_days == 60 and c.earnings.surprise_positive is True
        t = frame.turbo_candidates[0]
        assert isinstance(t, TurboCandidateInput)
        assert t.atr == Decimal("1.20") and t.premarket_volume == 200_000

    def test_marks_present_per_symbol(self):
        frame = _provider([_spec()]).poll()
        assert frame.marks["AAPL"] == Decimal("150.00")
        assert frame.marks["TSLA"] == Decimal("250.00")

    def test_valid_frame_is_tradable(self):
        frame = _provider([_spec()]).poll()
        assert frame.quality.valid is True
        assert frame.tradable is True

    def test_determinism(self):
        f1 = _provider([_spec()]).poll()
        f2 = _provider([_spec()]).poll()
        assert f1.market_facts == f2.market_facts
        assert f1.core_candidates == f2.core_candidates
        assert f1.marks == f2.marks

    def test_exhaustion(self):
        p = _provider([_spec()])
        p.poll()
        assert p.exhausted() is True
        with pytest.raises(StopIteration):
            p.poll()


# --------------------------------------------------------------------------- #
# Data-quality — five failure types
# --------------------------------------------------------------------------- #

class TestDataQuality:
    def test_market_closed_withholds_frame(self):
        frame = _provider([_spec(market_open=False)]).poll()
        assert frame.quality.valid is False
        assert MARKET_CLOSED in frame.quality.fatal_issues
        assert frame.market_facts is None  # withheld; no fabricated facts
        assert frame.tradable is False

    def test_missing_spy_price_is_fatal(self):
        frame = _provider([_spec(market_facts={"spy_price": None, "spy_sma_200": "470"})]).poll()
        assert frame.quality.valid is False
        assert MISSING_PRICE in frame.quality.fatal_issues
        assert frame.market_facts is None

    def test_stale_data_is_fatal(self):
        old = {"captured_at": _now() - timedelta(seconds=3600)}
        frame = _provider([_spec(**old)], max_age_sec=300).poll()
        assert frame.quality.valid is False
        assert STALE_DATA in frame.quality.fatal_issues

    def test_duplicate_bar_is_fatal(self):
        p = _provider([_spec(bar_id="B1"), _spec(bar_id="B1")])
        first = p.poll()
        second = p.poll()
        assert first.quality.valid is True
        assert second.quality.valid is False
        assert DUPLICATE_BAR in second.quality.fatal_issues

    def test_missing_mark_drops_candidate(self):
        # AAPL has no mark -> dropped; TSLA kept
        frame = _provider([_spec(marks={"TSLA": "250.00"})]).poll()
        assert ("AAPL", MISSING_PRICE) in frame.quality.dropped
        assert all(c.symbol != "AAPL" for c in frame.core_candidates)
        assert any(t.symbol == "TSLA" for t in frame.turbo_candidates)
        # frame still valid at market level (SPY present)
        assert frame.quality.valid is True

    def test_invalid_volume_drops_candidate(self):
        frame = _provider([_spec(core=[_core_spec(adv=0)])]).poll()
        assert ("AAPL", INVALID_VOLUME) in frame.quality.dropped
        assert frame.core_candidates == ()

    def test_invalid_premarket_volume_drops_turbo(self):
        frame = _provider([_spec(turbo=[_turbo_spec(premkt=-1)])]).poll()
        assert ("TSLA", INVALID_VOLUME) in frame.quality.dropped
        assert frame.turbo_candidates == ()


# --------------------------------------------------------------------------- #
# Refresh worker (B8 Worker) — no engine calls; non-fatal on bad frame
# --------------------------------------------------------------------------- #

class TestRefreshWorker:
    def test_publishes_latest_frame(self):
        w = MarketDataRefreshWorker(_provider([_spec()]))
        w.run_once()
        assert w.last_frame is not None and w.last_frame.tradable is True

    def test_exhausted_provider_is_noop(self):
        p = _provider([_spec()])
        w = MarketDataRefreshWorker(p)
        w.run_once()  # consumes the one frame
        w.run_once()  # provider exhausted -> no-op, must not raise
        assert w.last_frame is not None

    def test_bad_frame_records_alert_and_dlq(self):
        dal = DataAccessLayer()
        alerts = AlertManager(dal, dispatchers=[])
        dlq = DeadLetterQueue(dal)
        w = MarketDataRefreshWorker(
            _provider([_spec(market_open=False)]), alert_manager=alerts, dlq=dlq
        )
        w.run_once()  # fatal frame
        events = dal.system_events.list(event_type=SystemEventType.GATEWAY_EVENT)
        assert any((e.detail or {}).get("kind") == "market_data_quality" for e in events)
        assert dlq.depth() == 1

    def test_worker_makes_no_engine_calls(self):
        import src.app.marketdata.worker as mod
        src = open(mod.__file__).read()
        for forbidden in ("selection.engine", "risk.engine", "execution.engine",
                          "SelectionEngine", "RiskDecisionEngine", "ExecutionEngine",
                          "portfolio"):
            assert forbidden not in src


# --------------------------------------------------------------------------- #
# Provider-independence (a second provider implements the same ABC)
# --------------------------------------------------------------------------- #

class TestProviderIndependence:
    def test_alternate_provider_works_with_worker(self):
        class _StubProvider(MarketDataProvider):
            def __init__(self, frame):
                self._frame = frame
                self._done = False

            def exhausted(self):
                return self._done

            def poll(self):
                self._done = True
                return self._frame

        frame = _provider([_spec()]).poll()
        w = MarketDataRefreshWorker(_StubProvider(frame))
        w.run_once()
        assert w.last_frame is frame


# --------------------------------------------------------------------------- #
# Source guarantees: no engine/broker/vendor coupling in the package
# --------------------------------------------------------------------------- #

class TestNoForbiddenCoupling:
    def test_package_has_no_broker_vendor_or_engine_calls(self):
        # Check actual imports/usage, not docstring words (which legitimately say
        # "no TradingView / no IBKR").
        import os
        import src.app.marketdata as pkg
        pkg_dir = os.path.dirname(pkg.__file__)
        blob = ""
        for fn in os.listdir(pkg_dir):
            if fn.endswith(".py"):
                blob += open(os.path.join(pkg_dir, fn)).read().lower()
        for forbidden in ("import requests", "import socket", "import urllib",
                          "from urllib", "import ib_insync", "import yfinance",
                          "import polygon", "from src.selection.engine",
                          "from src.risk.engine", "from src.execution.engine"):
            assert forbidden not in blob
