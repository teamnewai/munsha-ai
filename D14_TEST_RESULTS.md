# D14_TEST_RESULTS

**Phase:** D14 — paper-validation reporting/measurement.

## 1. Quality Gates
| Gate | Command | Result |
|------|---------|--------|
| Lint (ruff) | `ruff check src/app/validation/ tests/test_validation.py` | ✅ All checks passed |
| Lint (flake8) | `flake8 --max-line-length=100 …` | ✅ clean |
| Type (mypy) | `mypy src/app/validation/ --follow-imports=skip` | ✅ no issues found in 4 source files |
| Full suite | `pytest tests/ -q` | ✅ **389 passed, 24 skipped** |
| D14 suite | `pytest tests/test_validation.py -q` | ✅ **17 passed** |

## 2. Totals
| | Before D14 | After D14 |
|---|---|---|
| Passed | 372 | **389 (+17)** |
| Skipped | 24 | 24 |
| Failed | 0 | **0** |

## 3. D14 Tests (17, verbose)
```
TestMetrics::test_basic_win_loss_pnl                              PASSED
TestMetrics::test_profit_factor_none_when_no_losses              PASSED
TestMetrics::test_short_pnl                                      PASSED
TestMetrics::test_max_drawdown_and_recovery                      PASSED
TestMetrics::test_unrecovered_drawdown                           PASSED
TestMetrics::test_consecutive_streaks                            PASSED
TestMetrics::test_r_multiple_proxy_labeled                       PASSED
TestMetrics::test_breakdowns_direction_and_band                  PASSED
TestMetrics::test_empty_is_safe                                  PASSED
TestRegimeCoverage::test_regimes_observed_from_audit             PASSED
TestReporter::test_daily_report_persists_performance_record      PASSED
TestReporter::test_cumulative_report                             PASSED
TestReporter::test_reporter_writes_no_domain_rows                PASSED
TestGate::test_passes_with_relaxed_thresholds                    PASSED
TestGate::test_fails_on_default_policy_thresholds                PASSED
TestGate::test_profit_factor_none_passes_when_profitable         PASSED
TestNoForbiddenCoupling::test_validation_pkg_has_no_engine_or_vendor_calls  PASSED
```

## 4. Coverage Summary
- **Metrics:** win/loss/PnL; profit factor (incl. None-when-no-losses); short PnL + direction coverage; max drawdown + recovery (and unrecovered case); consecutive streaks; R-multiple proxy (labeled); sector/direction/score-band breakdowns; empty-data safety; portfolio return.
- **Regime coverage:** distinct regimes derived from `scan` audit events; per-trade attribution flagged False.
- **Period reports:** daily report persists a `performance_records` row (existing table); cumulative report computed read-only; **reporter writes no domain rows**.
- **Pass/Fail gate:** passes under relaxed thresholds; **fails under the default owner policy** (200 trades/85% etc.); profit-factor-None passes when profitable.
- **No forbidden coupling:** no engine/vendor/ML imports; no recommendation code.

All prior tests remain green; **no regressions**.
