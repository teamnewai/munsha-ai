# OR1_ENTRYPOINT_BUILD_REPORT

**Phase executed:** OR-1 — Composition Entrypoint (resolves readiness blocker OR-1).
**Authorization:** `COMPOSITION_ENTRYPOINT_ARCHITECTURE.md` approved (`29394eb`). Implement OR-1 only.
**Result:** ✅ Complete. **406 passed · 24 skipped** (389 prior + **17 new tests**). ruff/flake8 clean; `run.py` mypy-clean.
**Footprint:** purely additive — `src/app/run.py` + `tests/test_run.py`. **No frozen file modified** (D1–D14A, P-SIZE, P-DATA, P-ORCH, D14, existing `src/app/*`; diff empty).

---

## 1. Files Created (all new)
| File | Purpose |
|------|---------|
| `src/app/run.py` | `compose() -> Application` (+ `load_fixtures`, minimal `main`) — wiring + lifecycle only |
| `tests/test_run.py` | 17 entrypoint tests |

## 2. What Was Built (exactly per architecture §1–§2)
`compose()` constructs **existing approved components only**, in order:
1. `bootstrap()` [B9] — health-gated (PG-unreachable ⇒ `PersistenceError` abort) + B9 recovery; returns a **not-started** `Application`.
2. `CapitalSettings.from_env()` + `SizingPolicy()` [P-SIZE] — fail-fast on missing/invalid/non-finite config.
3. `make_execution_target(dal=…)` [D11] — env-driven; **paper/signals only**; `ibkr`/`tradingview` → `NotImplementedError`.
4. `ReplayMarketDataProvider(fixtures)` [P-DATA] — fixtures loaded from `MARKET_DATA_FIXTURES` JSON path (missing/unreadable/non-list ⇒ abort; no fabricated data).
5. `PipelineOrchestrator.from_application(...)` [P-ORCH] — operator id from `OPERATOR_USER_ID` (per architecture "operator_user_id from config"; invalid ⇒ abort).
6. `TradingCycleWorker` → `app.scheduler.register(worker)` [B8] — **registered, NOT started**.

`main(argv)`: composes; **without `--start` it dry-composes and exits 0** (never auto-starts); with `--start` (the operator's explicit action) it calls `application.start()`, then routes Ctrl+C to `application.shutdown()` (graceful). Recovery and shutdown are **delegated to B9**, not reimplemented.

**Entrypoint config surface (non-secret, per architecture "env + fixture path"):** `MARKET_DATA_FIXTURES` (path), `OPERATOR_USER_ID` (UUID), `TRADING_CYCLE_INTERVAL_SEC`, `MARKET_DATA_MAX_AGE_SEC` — plus the pre-existing required vars (`DATABASE_URL`, `STARTING_CAPITAL`, `POSITION_ALLOCATION_FRACTION`, `EXECUTION_TARGET`).

## 3. Mandated Verifications (all gated + tested)
| Verification | Evidence |
|---|---|
| **Smoke test** | `test_one_cycle_end_to_end`: composed app → `scheduler.run_all_once()` → 1 FILLED paper order + open position; `broker_ref="paper:"` |
| **Startup path** | composed-not-started (`_started=False`; worker registered); explicit `start()` flips it |
| **Shutdown path** | `start()` → `shutdown()` → `_started=False` + `ServiceStopped` event persisted |
| **Recovery path** | in-flight `Sent` order pre-seeded → `app.recovery.in_flight_orders == 1` (fingerprint re-registered via B9) |
| Abort paths | non-paper target / missing fixtures / missing-or-bad operator / NaN capital / PG-unreachable (injected failing bootstrap) — all raise cleanly |
| Reuse-only | no engine/vendor/network imports (source-asserted) |

## 4. Quality Gates
ruff ✅ · flake8 ✅ · mypy `run.py` ✅ "no issues" · full suite **406 passed / 24 skipped** · entrypoint suite **17 passed** · additive-diff over all frozen layers **empty**.

## 5. Assumptions / Notes
1. **Test-injection seams** (`application=`, `fixtures=`, `execution_target=`, etc.) exist only so tests can wire the in-memory `Application` (anticipated by architecture DoD #9); the production path is fully env-driven.
2. **`--start` CLI flag = the operator's explicit start** (B9 OD-D6 honored; no flag ⇒ dry-compose, exit 0, never started — test-proven).
3. **Default target remains `signals`** (D11 OD-1) when `EXECUTION_TARGET` is unset; the paper campaign sets `EXECUTION_TARGET=paper` (P-DEPLOY). `ibkr`/`tradingview` abort.
4. **OPERATOR_USER_ID** must reference the seeded operator user (P-DEPLOY seed step); the entrypoint validates UUID shape only — row existence is part of P-DEPLOY provisioning/validation.

## 6. Remaining Blockers (unchanged, NOT started)
**OR-2** market-data fixtures · **OR-3** PostgreSQL provisioning. Also not started: TradingView, IBKR, Live Trading, D14A.

## 7. Gate
**OR-1 is COMPLETE.** Accompanying: `OR1_ENTRYPOINT_ARCHITECTURE_COMPLIANCE_REPORT.md`, `OR1_ENTRYPOINT_TEST_RESULTS.md`.

**STOP — awaiting owner approval.**
