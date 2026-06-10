# P-SIZE_TEST_RESULTS

**Phase:** P-SIZE (Phase 1). **Date basis:** post-implementation gate run.

---

## 1. Quality Gates

| Gate | Command | Result |
|------|---------|--------|
| Lint (ruff) | `ruff check src/app/sizing.py tests/test_sizing.py` | ✅ **All checks passed!** |
| Lint (flake8) | `flake8 --max-line-length=100 …` | ✅ **clean** (exit 0) |
| Type check (mypy) | `mypy src/app/sizing.py --follow-imports=skip` | ✅ **Success: no issues found in 1 source file** |
| Full test suite | `pytest tests/ -q` | ✅ **321 passed, 24 skipped** |
| P-SIZE suite | `pytest tests/test_sizing.py -v` | ✅ **25 passed** |

> Note: a non-skipped mypy run that follows transitive imports reports **55 pre-existing errors** in frozen B7/B9 files (`persistence/dal.py`, `app/bootstrap.py`). These predate P-SIZE, are **not** introduced by it, and the frozen files are **not** modified. `sizing.py` is type-clean in isolation.

## 2. Test Inventory (25 new, always-run)

**TestFormula (4)** — basic (100k×0.10÷10 → 1000); floor rounding (→666); whole-shares-only (int); full allocation.
**TestNoTrade (11)** — missing mark; mark zero; mark negative; invalid mark type; capital zero; capital negative; allocation zero; allocation negative; allocation > 1 (not clamped); unaffordable; every No-Trade has an explicit non-empty reason.
**TestProperties (5)** — determinism; candidate-not-used-in-math; non-compounding base = configured capital; signature has no risk/volatility inputs; source has no ML/numeric-library imports.
**TestCapitalSettingsFromEnv (4)** — reads env; missing capital raises; missing allocation raises; unparseable raises.
**TestSizingResult (1)** — `no_trade` helper.

## 3. Full Verbose Output (P-SIZE)

```
collected 25 items

tests/test_sizing.py::TestFormula::test_basic PASSED
tests/test_sizing.py::TestFormula::test_floor_rounding_down PASSED
tests/test_sizing.py::TestFormula::test_whole_shares_only PASSED
tests/test_sizing.py::TestFormula::test_full_allocation PASSED
tests/test_sizing.py::TestNoTrade::test_missing_mark PASSED
tests/test_sizing.py::TestNoTrade::test_mark_zero PASSED
tests/test_sizing.py::TestNoTrade::test_mark_negative PASSED
tests/test_sizing.py::TestNoTrade::test_invalid_mark_type PASSED
tests/test_sizing.py::TestNoTrade::test_capital_zero PASSED
tests/test_sizing.py::TestNoTrade::test_capital_negative PASSED
tests/test_sizing.py::TestNoTrade::test_allocation_zero PASSED
tests/test_sizing.py::TestNoTrade::test_allocation_negative PASSED
tests/test_sizing.py::TestNoTrade::test_allocation_above_one_not_clamped PASSED
tests/test_sizing.py::TestNoTrade::test_unaffordable PASSED
tests/test_sizing.py::TestNoTrade::test_no_trade_always_explicit_reason PASSED
tests/test_sizing.py::TestProperties::test_determinism PASSED
tests/test_sizing.py::TestProperties::test_candidate_not_used_in_math PASSED
tests/test_sizing.py::TestProperties::test_non_compounding_base_is_configured_capital PASSED
tests/test_sizing.py::TestProperties::test_signature_has_no_risk_or_volatility_inputs PASSED
tests/test_sizing.py::TestProperties::test_source_has_no_risk_or_ml_logic PASSED
tests/test_sizing.py::TestCapitalSettingsFromEnv::test_reads_env PASSED
tests/test_sizing.py::TestCapitalSettingsFromEnv::test_missing_capital_raises PASSED
tests/test_sizing.py::TestCapitalSettingsFromEnv::test_missing_allocation_raises PASSED
tests/test_sizing.py::TestCapitalSettingsFromEnv::test_unparseable_raises PASSED
tests/test_sizing.py::TestSizingResult::test_no_trade_helper PASSED

============================== 25 passed in 0.09s ==============================
```

## 4. Suite Totals

| Suite | Before P-SIZE | After P-SIZE |
|-------|---------------|--------------|
| Passed | 296 | **321** (+25) |
| Skipped | 24 | 24 (DB-gated, unchanged) |
| Failed | 0 | **0** |

All prior tests remain green; P-SIZE adds 25; **no regressions**.
