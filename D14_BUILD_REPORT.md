# D14_BUILD_REPORT

**Phase executed:** D14 — Paper-validation reporting & performance-measurement layer.
**Authorization:** P-VALIDATION approved/closed (`bc7dd92`). Implement D14 reporting only; **D14A not started**.
**Implemented exactly per:** `D14_PAPER_VALIDATION_ARCHITECTURE.md` (+ the P-VALIDATION campaign needs).
**Result:** ✅ Complete. **389 passed · 24 skipped** (372 prior + **17 new D14 tests**). Lint clean (ruff + flake8); validation package mypy-clean.
**Footprint:** purely additive — new `src/app/validation/` package + `tests/test_validation.py`. **No frozen file modified** (D1–D14A core, P-SIZE, P-DATA, P-ORCH, existing `src/app/*`; diff empty).

---

## 1. Files Created (all new)
| File | Purpose |
|------|---------|
| `src/app/validation/__init__.py` | Package exports |
| `src/app/validation/metrics.py` | `compute_validation_metrics` + `ValidationReport`/`Breakdown` — read-only metrics (reuses D6) |
| `src/app/validation/report.py` | `ValidationReporter` — daily/weekly/monthly period reports (existing `performance_records`) + cumulative report |
| `src/app/validation/gate.py` | `ValidationThresholds` + `GateResult` + `evaluate` — read-only Pass/Fail eligibility |
| `tests/test_validation.py` | 17 D14 tests |

## 2. Requirement Compliance (owner D14 requirements)
| Requirement | Status |
|-------------|--------|
| 1. Follow approved D14 architecture exactly | ✅ metrics (§4) + period reports (§5) + eligibility gate (§5) |
| 2–6. No strategy/risk/execution/allocation/profit changes | ✅ read-only analytics; reuses D6 formulas; no engine touched |
| 7. No auto-tuning | ✅ no parameter mutation; gate only reports pass/fail |
| 8. **No recommendation engine** | ✅ none (D14A out of scope; package has no recommendation code) |
| 9. PostgreSQL source of truth | ✅ reads persisted rows; only write = `performance_records.add` (existing table) |
| 10. Preserve all D1–D14A invariants | ✅ additive; no schema/enum; no D1–D14A modification |

## 3. What Was Built
- **Metrics (read-only, reuse D6):** trades/wins/losses/win-rate, **profit factor** (None when no losses), **R-multiple proxy** (OD-D14-1, labeled), **max drawdown + recovery** (D6 `EquityTracker` over the realized-PnL equity curve), **consecutive W/L streaks**, **portfolio return**, **breakdowns** by sector / direction / score-band, **regime coverage** (distinct regimes from `scan` audit events), **direction coverage** (long/short tested), `span_days`/`active_trading_days`, and a `data_quality` block (R-proxy label, realized-only equity curve, regime-per-trade not attributed).
- **Period reports:** `ValidationReporter` reuses D6 `StatisticsCalculator` to write daily/weekly/monthly rows into the **existing `performance_records`** table — **no schema change**.
- **Pass/Fail gate:** `evaluate(report, ValidationThresholds)` checks the owner policy (30d / 200 trades / WR ≥85% / PF ≥2.0 / MaxDD ≤10% / positive return / recovery / ≥2 regimes / long+short). Read-only eligibility; defaults encode the approved policy.

## 4. Assumptions / Known Limitations
1. **Additive** `src/app/validation/`; no existing file modified.
2. **Equity curve uses realized PnL of closed positions** (open/unrealized excluded — D6 fail-safe; deterministic, DB-driven). Documented in `data_quality`.
3. **R-multiple is a labeled proxy** (no per-trade risk basis in v1; OD-D14-1).
4. **Regime per-trade attribution is not persisted** by the current orchestration → **regime coverage** for the policy gate is derived from `scan`/`cycle_summary` audit events (distinct regimes observed); per-trade regime breakdown is reported as unattributed (`data_quality.regime_per_trade_attributed=False`, OD-D14-2). Direction/sector/score-band breakdowns are fully attributed.
5. **Duration:** `span_days` (earliest open → latest close, NY calendar) used for the duration gate; `active_trading_days` reported for info. The campaign also tracks `campaign_start` separately (P-VALIDATION).
6. **Only DAL write is `performance_records.add`** (existing table; period reports). **No domain-entity write** (positions/orders/fills/signals/scores/risk_checks/instruments/market_snapshots) — verified.

## 5. Remaining Risks
- **R1 (Low/documented):** regime per-trade breakdown unavailable (coverage via audit events satisfies the ≥2-regime gate); full per-trade regime attribution would need the orchestrator to persist a signal→snapshot link (future, schema-free addition).
- **R2 (Info):** durable storage of extended (non-`performance_records`) metrics is deferred (D14 OD-D14-3); the cumulative report is computed/exported read-only and reproducible.
- Neither blocks the validation campaign; neither alters frozen behavior.

## 6. Gate
**D14 is COMPLETE.** With D14, the validation campaign can compute daily/cumulative `ValidationReport`s and evaluate Pass/Fail.
**Not started:** D14A · TradingView · IBKR · Live Trading · any later phase.
Accompanying: `D14_ARCHITECTURE_COMPLIANCE_REPORT.md`, `D14_TEST_RESULTS.md`.

**STOP — awaiting owner approval.**
