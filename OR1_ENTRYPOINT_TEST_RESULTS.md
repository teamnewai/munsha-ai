# OR1_ENTRYPOINT_TEST_RESULTS

**Phase:** OR-1 — Composition Entrypoint.

## 1. Quality Gates
| Gate | Command | Result |
|------|---------|--------|
| Lint (ruff) | `ruff check src/app/run.py tests/test_run.py` | ✅ All checks passed |
| Lint (flake8) | `flake8 --max-line-length=100 …` | ✅ clean |
| Type (mypy) | `mypy src/app/run.py --follow-imports=skip` | ✅ no issues found in 1 source file |
| Full suite | `pytest tests/ -q` | ✅ **406 passed, 24 skipped** |
| OR-1 suite | `pytest tests/test_run.py -q` | ✅ **17 passed** |

## 2. Totals
| | Before OR-1 | After OR-1 |
|---|---|---|
| Passed | 389 | **406 (+17)** |
| Skipped | 24 | 24 (pre-existing DB-gated) |
| Failed | 0 | **0** |

## 3. OR-1 Tests (17, verbose)
```
TestCompose::test_returns_composed_not_started_application      PASSED
TestCompose::test_recovery_ran_via_bootstrap                    PASSED
TestCompose::test_paper_target_default_from_env                 PASSED
TestAbortPaths::test_non_paper_target_aborts                    PASSED
TestAbortPaths::test_missing_fixtures_env_aborts                PASSED
TestAbortPaths::test_missing_operator_env_aborts                PASSED
TestAbortPaths::test_bad_operator_uuid_aborts                   PASSED
TestAbortPaths::test_invalid_capital_env_aborts                 PASSED
TestAbortPaths::test_pg_unreachable_aborts                      PASSED
TestLoadFixtures::test_loads_json_list                          PASSED
TestLoadFixtures::test_missing_file_aborts                      PASSED
TestLoadFixtures::test_non_list_aborts                          PASSED
TestLoadFixtures::test_env_fixture_path_used_by_compose         PASSED
TestSmoke::test_one_cycle_end_to_end                            PASSED
TestSmoke::test_start_and_shutdown_lifecycle                    PASSED
TestSmoke::test_main_without_start_flag_does_not_start          PASSED
TestReuseOnly::test_run_module_has_no_forbidden_imports         PASSED
```

## 4. Mandated-Verification Coverage
- **Smoke test:** one full autonomous cycle through the *composed* app (data → score → risk → size → paper fill → portfolio); FILLED order with `paper:` ref; open position.
- **Startup-path:** composed-not-started; worker registered; explicit `start()` required and honored; env-driven paper target path exercised.
- **Shutdown-path:** `start()` → `shutdown()` → stopped + `ServiceStopped` persisted; idempotent flag verified.
- **Recovery-path:** pre-seeded in-flight `Sent` order → B9 recovery via `compose()` re-registers its fingerprint (`recovery.in_flight_orders == 1`).
- **Error handling:** all five abort paths (non-paper target, missing fixtures, missing/bad operator, non-finite capital, PG-unreachable) raise cleanly before any loop exists.
- **Reuse-only:** no forbidden imports (engines/vendors/network).

All prior tests remain green; **no regressions**.
