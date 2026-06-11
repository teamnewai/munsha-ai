# P0_CLOSURE_REPORT

**Batch:** 1 (P0 + directly-related). **Source of findings:** `MASTER_PROGRAM_AUDIT.md`.
**Outcome:** ✅ P0 closed. The exit lifecycle is now operational — positions open **and close** in the running pipeline; D14 now sees real closed round-trips.
**Gates run once:** ruff ✅ · flake8 ✅ · mypy ✅ · pytest **450 passed / 24 skipped / 0 failed** (+11 new). No regressions; frozen layers untouched.

---

## 1. Findings fixed

| ID | Severity | Finding | Resolution |
|---|---|---|---|
| **F-1** | **P0** | Exit lifecycle not operational — positions opened but never closed; EX-1 wired to nothing | Implemented and wired the full exit leg: **EX-2** close execution, **EX-3** target close, **EX-4** P-ORCH exit stage, **EX-5** end-to-end. Positions now transition OPEN→CLOSED with `exit_price`/`closed_at`; D6 cash reflects realized PnL; D14 counts the trade. |
| **F-9** | **P3** (directly related) | EX-1 mypy errors (`Optional[Decimal]` not narrowed) | Rewrote the guards to inline `None`/finite checks so types narrow; engine behavior identical (33 EX-1 tests unchanged & green). Now **mypy-clean**. |

**How F-1 was closed (mechanics):**
- **EX-2 (`exit_execution.close_position`)** assembles the close from the **existing D5 primitives** — `create_order` → `submit_order` → `apply_fill` (order NEW→SENT→FILLED) then `PositionStateMachine` OPEN→CLOSED + `positions.update`. The closing order carries the **same direction** as the position (D5 `verify_matches` requires it), `signal_id=None` (nullable column), `broker_ref="paper:…"` (OD-5). Fills at the **supplied mark** (OD-4 / ratified gap-at-actual-price).
- **EX-3** adds `handle_close` to the execution-target seam: default no-op on the base (Signals-Only returns `None`), Paper delegates to EX-2.
- **EX-4** adds a P-ORCH exit stage that runs **after the L4 halt-check but before the entry data-quality/scanner gates**, so exits are **permitted at kill-switch L1–L3** and only halted at L4. It threads a re-derivable `ExitState` per position, calls EX-1 `evaluate`, executes CLOSE via the target, reflects via `portfolio.close_position`, isolates per-position failures, and audits each close.

---

## 2. Files changed

| File | Type | Purpose |
|---|---|---|
| `thul-nurayn/src/app/exit_decision.py` | modified | EX-1 mypy narrowing (F-9); behavior identical |
| `thul-nurayn/src/app/exit_execution.py` | **new** | EX-2 close execution (additive; reuses D5, no `engine.py` edit) |
| `thul-nurayn/src/app/targets/base.py` | modified | EX-3 `handle_close` default (no-op) on `ExecutionTarget` |
| `thul-nurayn/src/app/targets/paper.py` | modified | EX-3 `PaperTarget.handle_close` → delegates to EX-2 |
| `thul-nurayn/src/app/orchestrator.py` | modified | EX-4 exit stage + `CycleResult.closed` + exit-engine/state |
| `thul-nurayn/tests/test_exit_pipeline.py` | **new** | EX-2/EX-3/EX-4/EX-5 tests (11) |

**Frozen-layer integrity:** `git diff` over `src/execution/`, `src/risk/`, `src/portfolio/`, `src/models/`, `src/enums/`, `src/data_access/`, `src/selection/` is **empty**. D5 `engine.py` and the state machines are unchanged (EX-2 reuses them as an additive module). All edits are within the exit-leg scope authorized by `EXIT_CLOSE_ARCHITECTURE.md` (EX-2 D5-reuse, EX-3 D11-additive, EX-4 P-ORCH-additive).

---

## 3. Tests added

11 new tests in `tests/test_exit_pipeline.py` (the 33 EX-1 tests in `test_exit_decision.py` remain green):
- **EX-2:** close marks position CLOSED + fills the closing order (paper-tagged); rejects non-open; rejects invalid mark; short close reuses same-direction order.
- **EX-3:** Paper closes; Signals-Only is a no-op.
- **EX-4:** hard stop closes an open position next cycle (realized PnL `(137−150)×66 = −858` reflected in cash); flat mark holds (winners run); **L4 halts exits**; **exits run at L1** (scanner paused, position still closed).
- **EX-5:** after the round-trip, `compute_validation_metrics(...).trades == 1` — D14 now sees the closed trade (previously always 0, the blocker).

---

## 4. Quality gates (run once)

| Gate | Command | Result |
|---|---|---|
| ruff | `ruff check` (all changed files) | ✅ All checks passed |
| flake8 | `flake8 --max-line-length=100` | ✅ clean |
| mypy | `mypy` (5 changed src files, `--follow-imports=skip`) | ✅ no issues |
| Exit suites | `pytest test_exit_decision.py test_exit_pipeline.py` | ✅ **44 passed** |
| Full suite | `pytest tests/` | ✅ **450 passed · 24 skipped · 0 failed** |

Baseline was 439 passed / 24 skipped; now 450 / 24 (+11), **no regressions**.

---

## 5. Remaining findings (not in this batch)

Carried forward from `MASTER_PROGRAM_AUDIT.md` for subsequent batches:

| ID | Severity | Summary | Note |
|---|---|---|---|
| **F-5** | P1 | C-1 ↔ C-3 contradiction; Core structure-exit dormant | EX-4 passes `regime_is_bull=None`, `trend_stage2=None` (marks-computable path), so Core runs **hard-stop-only** as designed. The engine is forward-compatible; activating the trend trigger is an **owner input** (fund the Core data path or redefine C-1), not a code fix. |
| **F-2** | P1 | Campaign prerequisites (OR-2 fixtures + OR-3 PostgreSQL) | Next batch toward a runnable campaign. |
| **F-3** | P1 | Validation gate likely unreachable as configured | Owner input (gate posture vs winners-run). |
| **F-4** | P1 | Master Specification absent; values unverifiable | Owner input (supply Master-Spec values; current V-1…V-6 are provisional). |
| **F-6** | P1 | D14 R-multiple non-computable; regime attribution partial | Schema/linkage decision. |
| **F-8** | P1 | P-ORCH under-feeds D4 (weekly-DD + sector gates never bind) | Risk-feed wiring; recommended next code batch. |
| **F-7** | P2 | Live trading not implemented (by design) | Owner-gated, later. |
| **F-12** | P2 | P-DEPLOY not executed; provisioning unproven | With OR-3. |
| **F-10 / F-11** | P3 | Repo hygiene; stale "production-ready" docs | Cleanup. |

**Known limitation introduced (documented, not a defect):** the Turbo **session-close cutoff (V-6, minutes-before-close)** is dormant because the frame carries no `minutes_to_close` fact; the market-**closed** flatten path works (exits run before the data-quality gate, so a `market_open=False` frame flattens Turbo). Supplying a minutes-to-close fact is a later data-layer item.

---

## 6. Status

**Batch 1 complete. P0 closed; one directly-related P3 closed.** Audit once · fix once · verify once — done for this batch. Awaiting direction to proceed to the next batch (recommended: **F-8** risk-feed, then **F-2** campaign prerequisites). No further reports produced.
