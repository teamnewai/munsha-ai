"""THUL-NURAYN v1 — P-SIZE sizing tests (always-run).

Verifies the fixed-allocation policy: deterministic quantity from
{capital, allocation, mark} only; non-compounding base; no risk/volatility/
ATR/Kelly/dynamic inputs; explicit No-Trade (never fabricate) on ambiguous input.
"""

from __future__ import annotations

import inspect
from decimal import Decimal

import pytest

from src.app.sizing import (
    ENV_ALLOCATION,
    ENV_CAPITAL,
    CapitalSettings,
    SizingPolicy,
    SizingResult,
)


def _settings(cap="100000", alloc="0.10") -> CapitalSettings:
    return CapitalSettings(capital=Decimal(cap), allocation_fraction=Decimal(alloc))


def _policy() -> SizingPolicy:
    return SizingPolicy()


# --------------------------------------------------------------------------- #
# Formula correctness
# --------------------------------------------------------------------------- #

class TestFormula:
    def test_basic(self):
        r = _policy().size(None, _settings("100000", "0.10"), Decimal("10.00"))
        assert r.tradable is True
        assert r.quantity == 1000
        assert r.capital_base == Decimal("100000")
        assert r.allocation_value == Decimal("10000.00")
        assert r.reason == "ok"

    def test_floor_rounding_down(self):
        # 10000 / 15 = 666.66.. -> floor 666
        r = _policy().size(None, _settings("100000", "0.10"), Decimal("15.00"))
        assert r.quantity == 666
        assert r.tradable is True

    def test_whole_shares_only(self):
        r = _policy().size(None, _settings("100000", "0.10"), Decimal("3.33"))
        assert isinstance(r.quantity, int)
        assert r.quantity == int(Decimal("10000") / Decimal("3.33"))  # 3003

    def test_full_allocation(self):
        r = _policy().size(None, _settings("50000", "1"), Decimal("25"))
        assert r.quantity == 2000  # 50000 / 25


# --------------------------------------------------------------------------- #
# No-Trade paths (never fabricate)
# --------------------------------------------------------------------------- #

class TestNoTrade:
    def test_missing_mark(self):
        r = _policy().size(None, _settings(), None)
        assert r.tradable is False and r.quantity == 0
        assert "missing mark" in r.reason

    def test_mark_zero(self):
        r = _policy().size(None, _settings(), Decimal("0"))
        assert r.tradable is False and r.quantity == 0
        assert "invalid mark" in r.reason

    def test_mark_negative(self):
        r = _policy().size(None, _settings(), Decimal("-5"))
        assert r.tradable is False and r.quantity == 0

    def test_invalid_mark_type(self):
        r = _policy().size(None, _settings(), 10.0)  # float, not Decimal
        assert r.tradable is False and "invalid mark type" in r.reason

    def test_capital_zero(self):
        r = _policy().size(None, _settings("0", "0.10"), Decimal("10"))
        assert r.tradable is False and "invalid capital" in r.reason

    def test_capital_negative(self):
        r = _policy().size(None, _settings("-100", "0.10"), Decimal("10"))
        assert r.tradable is False and r.quantity == 0

    def test_allocation_zero(self):
        r = _policy().size(None, _settings("100000", "0"), Decimal("10"))
        assert r.tradable is False and "invalid allocation" in r.reason

    def test_allocation_negative(self):
        r = _policy().size(None, _settings("100000", "-0.1"), Decimal("10"))
        assert r.tradable is False and r.quantity == 0

    def test_allocation_above_one_not_clamped(self):
        # 1.5 is out of domain -> No Trade, NOT clamped to 1.0
        r = _policy().size(None, _settings("100000", "1.5"), Decimal("10"))
        assert r.tradable is False and "invalid allocation" in r.reason
        assert r.quantity == 0

    def test_unaffordable(self):
        # 10000 / 20000 = 0.5 -> floor 0 -> No Trade
        r = _policy().size(None, _settings("100000", "0.10"), Decimal("20000"))
        assert r.tradable is False and r.quantity == 0
        assert "unaffordable" in r.reason

    def test_no_trade_always_explicit_reason(self):
        for r in (
            _policy().size(None, _settings(), None),
            _policy().size(None, _settings("0"), Decimal("10")),
            _policy().size(None, _settings("100000", "2"), Decimal("10")),
            _policy().size(None, _settings("100000", "0.10"), Decimal("999999")),
        ):
            assert r.tradable is False
            assert r.quantity == 0
            assert isinstance(r.reason, str) and r.reason  # non-empty


# --------------------------------------------------------------------------- #
# Determinism / non-compounding / no extraneous inputs
# --------------------------------------------------------------------------- #

class TestProperties:
    def test_determinism(self):
        a = _policy().size(None, _settings("123456", "0.10"), Decimal("12.34"))
        b = _policy().size(None, _settings("123456", "0.10"), Decimal("12.34"))
        assert a == b

    def test_candidate_not_used_in_math(self):
        s, m = _settings("100000", "0.10"), Decimal("10")
        r1 = _policy().size(object(), s, m)
        r2 = _policy().size("a-different-candidate", s, m)
        r3 = _policy().size(None, s, m)
        assert r1.quantity == r2.quantity == r3.quantity == 1000

    def test_non_compounding_base_is_configured_capital(self):
        # Base is the owner-configured capital, never an equity/profit figure.
        r = _policy().size(None, _settings("200000", "0.10"), Decimal("10"))
        assert r.capital_base == Decimal("200000")
        assert r.quantity == 2000  # depends only on configured capital, not equity

    def test_signature_has_no_risk_or_volatility_inputs(self):
        params = list(inspect.signature(SizingPolicy.size).parameters)
        assert params == ["self", "candidate", "settings", "mark"]
        # no atr/volatility/risk/kelly/equity parameters exist
        for forbidden in ("atr", "volatility", "risk", "kelly", "equity", "vix"):
            assert forbidden not in params

    def test_source_has_no_risk_or_ml_logic(self):
        # No ML / stochastic / numeric-library imports (concept words may appear
        # in the docstring documenting what P-SIZE deliberately does NOT do).
        import src.app.sizing as mod
        src = open(mod.__file__).read().lower()
        for forbidden in ("import numpy", "from numpy", "import sklearn",
                          "from sklearn", "import random", "import math",
                          "tensorflow", "torch", "scipy"):
            assert forbidden not in src


# --------------------------------------------------------------------------- #
# CapitalSettings.from_env
# --------------------------------------------------------------------------- #

class TestCapitalSettingsFromEnv:
    def test_reads_env(self, monkeypatch):
        monkeypatch.setenv(ENV_CAPITAL, "150000")
        monkeypatch.setenv(ENV_ALLOCATION, "0.10")
        s = CapitalSettings.from_env()
        assert s.capital == Decimal("150000")
        assert s.allocation_fraction == Decimal("0.10")

    def test_missing_capital_raises(self, monkeypatch):
        monkeypatch.delenv(ENV_CAPITAL, raising=False)
        monkeypatch.setenv(ENV_ALLOCATION, "0.10")
        with pytest.raises(ValueError):
            CapitalSettings.from_env()

    def test_missing_allocation_raises(self, monkeypatch):
        monkeypatch.setenv(ENV_CAPITAL, "100000")
        monkeypatch.delenv(ENV_ALLOCATION, raising=False)
        with pytest.raises(ValueError):
            CapitalSettings.from_env()

    def test_unparseable_raises(self, monkeypatch):
        monkeypatch.setenv(ENV_CAPITAL, "not-a-number")
        monkeypatch.setenv(ENV_ALLOCATION, "0.10")
        with pytest.raises(ValueError):
            CapitalSettings.from_env()


# --------------------------------------------------------------------------- #
# SizingResult.no_trade helper
# --------------------------------------------------------------------------- #

class TestSizingResult:
    def test_no_trade_helper(self):
        r = SizingResult.no_trade("x")
        assert r.tradable is False and r.quantity == 0 and r.reason == "x"
