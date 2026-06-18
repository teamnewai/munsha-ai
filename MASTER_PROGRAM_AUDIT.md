# MASTER_PROGRAM_AUDIT

**Scope:** Single, comprehensive end-to-end audit of the THUL-NURAYN v1 trading backend (`thul-nurayn/`) and its governing documents. Supersedes and consolidates all prior exit-workstream reports, matrices, reviews, and blockers. **One document. Every issue once. Deduplicated, grouped, severity-ranked.**
**Method:** Source-verified against `thul-nurayn/src`, the test suite, and the repository docs. Test baseline captured live: **439 passed · 24 skipped** (DB-gated); EX-1 suite **33 passed**; ruff/flake8 clean; mypy **8 errors** (EX-1 only).
**Severity scale (owner-defined):** **P0** blocks system operation · **P1** blocks validation · **P2** blocks deployment · **P3** improvement only.
**No implementation performed in this audit. This document is the only deliverable.**

---

## 1. Executive Summary

THUL-NURAYN v1 is a **well-engineered entry-and-open trading backend** with disciplined, layered architecture (D1–D6 domain, B7–B9 integration, P-SIZE/P-DATA/P-ORCH pipeline, D14 read-only validation, OR-1 composition entrypoint) and a strong test posture (439 green). The work delivered is sound and internally consistent **up to the point of opening positions**.

The program has **one decisive structural gap and a small cluster of dependent blockers**: the system **opens positions but cannot close them in the running pipeline**. The exit *decision* engine (EX-1) is now implemented and tested, but the exit *execution* and *orchestration* (EX-2/EX-3/EX-4/EX-5) are not, so EX-1 is invoked by nothing. Because validation measures *closed* round-trips, **no validation gate can be evaluated**, which in turn blocks the paper campaign and every downstream deployment decision.

Beyond that single root cause, the audit finds: an **internal contradiction between two final owner decisions** (C-1 trend-stage exit vs C-3 marks-computable path) that renders the Core structure-exit dormant; **incomplete risk-gate wiring** in the autonomous pipeline (weekly-drawdown and sector gates are never fed); **validation thresholds that are likely unreachable as configured**; the **absence of the Master Specification** from the repository (so strategy values cannot be verified or finalized); and **repository-hygiene problems** (THUL-NURAYN docs are intermixed with an unrelated web application, including stale "production-ready" reports that contradict the true state).

**Nothing here invalidates the delivered work.** The fixes are additive and well-scoped. The critical path is: finish the exit leg (EX-2→EX-5), wire risk fully, provision the campaign (fixtures + PostgreSQL), then run validation.

---

## 2. Overall Project Status

| Layer / Phase | State | Verdict |
|---|---|---|
| **D1** Foundation (enums/models/schema) | Implemented, tested | ✅ Solid |
| **D2** Data access / Repository | Implemented, tested | ✅ Solid |
| **D3** Selection / Score engine | Implemented, tested | ✅ Solid |
| **D4** Risk gates | Implemented, tested (in isolation) | ⚠️ Sound but **under-fed by P-ORCH** (F-8) |
| **D5** Execution (orders/positions/state machines) | Implemented, tested | ✅ Solid; **no close-execution method** (F-1) |
| **D6** Portfolio (PnL/equity/stats) | Implemented, tested | ✅ Solid |
| **B7** Persistence (Postgres repos) | Implemented; integration tests **DB-gated/skip** | ⚠️ Unproven here (F-2/OR-3) |
| **B8** Operations (scheduler/workers/events) | Implemented, tested | ✅ Solid |
| **B9** Integration & recovery | Implemented, tested | ✅ Solid |
| **P-SIZE** Sizing | Implemented, tested, hardened | ✅ Solid |
| **P-DATA** Market data (replay/fixtures) | Implemented, tested | ✅ Solid; fixtures not authored (F-2) |
| **P-ORCH** Orchestrator (entry path) | Implemented, tested | ⚠️ Entry-only; **no exit stage** (F-1); risk under-fed (F-8) |
| **P-DEPLOY** | Architecture only | ❌ Not executed (F-12) |
| **P-VALIDATION** | Architecture only | ❌ Unrunnable until F-1/F-2 (F-2/F-3) |
| **D14** Paper validation (read-only) | Implemented, tested | ⚠️ Measures 0 closed trades today (F-1); metric gaps (F-6) |
| **D14A** Trade Intelligence | Architecture only | ❌ Not implemented (by design, gated) |
| **D10/D12** TradingView · **D13** IBKR | Architecture only; `NotImplementedError` | ❌ Live blocked (by design, F-7) |
| **OR-1** Composition entrypoint | Implemented, tested | ✅ Solid |
| **OR-2** Fixtures · **OR-3** PG provisioning | Not done | ❌ Campaign prerequisites (F-2) |
| **EX-1** Exit Decision Engine | Implemented, 33 tests green | ⚠️ Complete but **mypy-failing (F-9)** and **unwired (F-1)** |
| **EX-2…EX-5** Exit execution/orchestration | Not started | ❌ The core gap (F-1) |

**Net:** functional from data → score → risk → size → execute(open) → portfolio → audit, with a verified one-cycle smoke path. **Non-functional from open → manage → close → realize → validate.**

---

## 3. Critical Issues — P0 (blocks system operation)

### F-1 · Exit lifecycle is not operational — positions are opened but never closed
- **Root cause:** EX-2 (D5 position-close execution method), EX-3 (execution-target close path), EX-4 (P-ORCH exit-evaluation stage), and EX-5 (end-to-end) are **not implemented**. The EX-1 decision engine exists (`src/app/exit_decision.py`) but is **referenced by nothing** — verified: no import of `exit_decision`/`ExitDecision` in `orchestrator.py`, `targets/`, or `run.py`. `PaperTarget.handle_accepted` creates `PositionStatus.OPEN` and returns; `run_cycle` ends at `portfolio.open_position`.
- **Why P0:** the system cannot perform its defining function. In any run, positions accumulate indefinitely, no realized PnL is ever produced, cash never updates from closes, and exposure is never released. This is operational failure of a trading system, not merely a validation gap.
- **Consolidates:** `OR2_EXIT_PATH_BLOCKER.md` and all "exits unreachable" notes across the exit-workstream documents. **This is the single most important finding; most other blockers are downstream of it.**
- **Downstream of F-1:** F-2 (campaign), F-3 (gate evaluation), F-6 (D14 closed-trade metrics).

---

## 4. Major Issues — P1 (blocks validation)

### F-2 · Paper-validation campaign cannot run — prerequisites incomplete (one root: campaign not provisioned)
- **OR-2** market-data fixtures are not authored (paused pending F-1).
- **OR-3** PostgreSQL is not provisioned → the **24 skipped integration tests** never execute here, and "PostgreSQL is the sole source of truth" cannot hold for a real campaign on this environment.
- **Dependency:** even with fixtures + PG, a campaign produces **0 closed trades** until F-1 is fixed.
- **Why P1:** without this, no validation metric set can be generated.

### F-3 · Validation thresholds are likely unreachable as configured (internal tension)
- Implemented gate (`src/app/validation/gate.py`): `min_trades=200`, `min_win_rate=0.85`, `min_profit_factor=2.0`, `max_drawdown_limit=−0.10`.
- **Win Rate ≥ 0.85 AND Profit Factor ≥ 2.0** under a *winners-run* philosophy are in structural tension; additionally the frozen convention **win = realized PnL > 0** counts break-even/scratch exits as losses, depressing the very WR gate.
- **Why P1:** a fully working pipeline can still fail validation **by construction**. Requires an owner reconciliation of gate values vs philosophy (an *input*, not a new document).

### F-4 · Master Specification absent from the repository — strategy values unverifiable
- `THUL-NURAYN_v1_MASTER_SPECIFICATION.md` is cited everywhere as "single source of truth (20 sections)" but is **not present** (`git ls-files` shows only `D1_FOUNDATION_SPECIFICATION.md`).
- Consequence: exit values **V-1…V-6 do not exist anywhere** (only provisional placeholders in `ExitConfig.provisional()`); and the many "transcribed verbatim from Master Spec" threshold claims (D3/D4 constants) **cannot be verified** from the repo.
- **Why P1:** faithful finalization (and audit) of strategy values is impossible without the source; provisional values have no validation meaning.

### F-5 · Contradiction between final owner decisions C-1 and C-3 — Core structure-exit is dormant
- **C-1** (final): Core exit = **Trend-Stage break AND Regime flip**. **C-3** (final): **marks-computable Core path** (no per-cycle recomputation of `trend_stage2` for open positions).
- Therefore `trend_stage2` is always supplied as `None` → the AND's trend component never confirms → **the Core structure exit can never fire**; Core runs effectively **hard-stop-only**. EX-1 implements this faithfully (fail-safe HOLD), but the *intended* Core profit-side exit is inert.
- **Why P1:** Core would hold winners until the hard stop or (never-satisfied) structure break, materially changing Core's realized-trade distribution and the validity of any campaign that includes Core. Resolvable only by (a) funding the Core data path, or (b) revising C-1 to a marks-computable trigger (e.g., regime-flip alone) — an owner input.

### F-6 · D14 metric coverage gaps (one root: missing per-trade bases/linkage)
- **R-multiple (metric 12):** non-computable — no risk basis persisted (V2-001). The new hard stops create a risk basis, but X-3 declined to persist it (no schema change), so it remains non-computable.
- **Regime performance (metric 18):** depends on `order→signal→scanner→market_snapshot` linkage that may be absent → results bucket as "unknown."
- **Why P1:** two of the required validation metrics are partially or wholly unavailable.

### F-8 · P-ORCH feeds D4 incompletely — weekly-drawdown and sector gates never bind in the autonomous flow
- `orchestrator.py:221` calls `self._rsb.build(daily_drawdown=snapshot.drawdown)` **only**. `RiskStateBuilder.build` defaults `weekly_drawdown=0`, `candidate_sector_current_exposure=0`, `candidate_sector_added_exposure=0`.
- Consequence: **WeeklyDrawdownGate (−6%) and SectorExposureGate (≤25%) can never trigger** in the orchestrated pipeline; they pass unconditionally. Also the value passed as "daily_drawdown" is the **overall snapshot drawdown** (an approximation of *daily*).
- **Why P1:** risk enforcement is incomplete in the very flow that will run the campaign, undermining the integrity of paper results (and, later, live safety). The gates are correct and unit-tested in isolation; the defect is the **input wiring**.

---

## 5. Minor Issues — P2 (deployment) and P3 (improvement)

### F-7 · Live trading not implemented (P2 — by design, owner-gated)
- TradingView (D10/D12) and IBKR (D13) are architecture-only; `targets/selection.py` raises `NotImplementedError` for `ibkr`/`tradingview`. Hard live-deployment blocker, but **intentional and gated** — recorded for completeness, not a defect.

### F-12 · P-DEPLOY not executed; provisioning/seed/secrets unproven (P2)
- P-DEPLOY is architecture only. `OPERATOR_USER_ID` seed, env config (`DATABASE_URL`, `STARTING_CAPITAL`, `POSITION_ALLOCATION_FRACTION`, `EXECUTION_TARGET`, market-data fixtures), and secrets handling are not provisioned/verified here. Overlaps OR-3 (F-2).

### F-9 · EX-1 mypy type errors (P3)
- 8 mypy errors in `exit_decision.py` (`Optional[Decimal]` not narrowed before `max`/`min`/`*` in `advance_state` and `_evaluate_turbo`). **Logic is correct and runtime-guarded** (`_usable`), and ruff/flake8/tests are clean — but the project gate requires mypy-clean. Trivial fix (local narrowing/assert after the `_usable` guard).

### F-10 · Repository hygiene — THUL-NURAYN intermixed with an unrelated web product (P3)
- The repo root is a **TypeScript/React + Supabase web application** (`src/`, `public/`, `supabase/`, `package.json`) — a different product. THUL-NURAYN's **documents live at the repo root** and its **code under `thul-nurayn/`**, interleaved with the web app's reports.
- Consequences: source-of-truth confusion, the missing Master Spec (F-4), audit noise, and potential CI/build conflicts between two stacks.

### F-11 · Contradictory / stale "production-ready" documents (P3)
- Root contains `FINAL_PRODUCTION_GO_LIVE_REPORT.md`, `FINAL_PRE_LAUNCH_AUDIT.md`, `PRODUCTION_DEPLOYMENT_CHECKLIST.md`, `FINAL_PRODUCTION_REPORT.md` asserting production readiness — these belong to the web product and **directly contradict** THUL-NURAYN's true state (no exits, no live broker, no PG provisioning). See §10.

---

## 6. Missing Components (consolidated)

| Component | Status | Finding |
|---|---|---|
| Position-close execution (D5 method) | Missing | F-1 |
| Execution-target close path (Paper/SignalsOnly) | Missing | F-1 |
| P-ORCH exit-evaluation stage | Missing | F-1 |
| End-to-end exit verification | Missing | F-1 |
| Market-data fixtures (OR-2) | Missing | F-2 |
| PostgreSQL provisioning (OR-3) | Missing | F-2 |
| Weekly-DD + sector exposure relay into D4 | Missing wiring | F-8 |
| Persisted risk basis (R-multiple) | Missing (deferred) | F-6 |
| Master Specification document | Absent from repo | F-4 |
| D14A Trade Intelligence | Not implemented (gated) | by design |
| TradingView / IBKR adapters | Not implemented (gated) | F-7 |
| Partial-profit-taking | Deferred to V2 | by design |

---

## 7. Validation Gaps (consolidated)

1. **No closed trades** → every gate (trades, WR, PF, DD, recovery) reads empty (F-1).
2. **Campaign cannot run** (no fixtures, no PG) (F-2).
3. **Gate values likely unreachable** as configured + scratch-as-loss artifact (F-3).
4. **R-multiple non-computable; regime attribution partial** (F-6).
5. **Core structure-exit dormant** → Core trade distribution is not what the strategy intends, skewing any campaign that includes Core (F-5).
6. **Risk gates under-fed** → paper results don't reflect full risk enforcement (F-8).

---

## 8. Deployment Gaps (consolidated)

1. **PostgreSQL not provisioned**; integration tests skip (F-2/F-12).
2. **P-DEPLOY not executed** — env/seed/secrets unproven (F-12).
3. **No live execution path** — TradingView/IBKR are stubs (F-7).
4. **Validation not passed** (prerequisite to any live gate) — blocked by §7.

---

## 9. Architecture Deviations

- **D-1 (real):** the autonomous pipeline enforces only a subset of D4 gates (F-8). The architecture intends all eight gates; the orchestrator wires inputs for one. *Deviation between intended risk model and orchestrated behavior.*
- **D-2 (real):** C-3 marks-computable path deviates from the C-1 exit definition, leaving a ratified exit trigger non-functional (F-5). *Two approved decisions are mutually inconsistent.*
- **D-3 (process):** strategy values are asserted "transcribed verbatim from Master Spec," but the Master Spec is not in the repo (F-4). *Provenance cannot be verified.*
- **No deviation** found in D1–D3, D5 (open path), D6, B7–B9, P-SIZE, P-DATA, OR-1, EX-1: these match their approved architectures. (EX-1 matches its spec; its only defect is type-checking, F-9.)

---

## 10. Contradictions Between Documents

1. **"Production-ready" claims vs actual state.** `FINAL_PRODUCTION_GO_LIVE_REPORT` / `PRODUCTION_DEPLOYMENT_CHECKLIST` (web-product artifacts) vs THUL-NURAYN having no exits/no live/no PG (F-11/F-10).
2. **OP-3 (exits frozen → V2) vs EX work (exits built in v1).** Reconciled by the owner's X-4 exception ruling — **resolved**, recorded here so it is not re-raised.
3. **C-1 vs C-3** (F-5) — unresolved logical contradiction between two final decisions.
4. **Validation gate values vs profit policy** (F-3) — the 0.85 WR + 2.0 PF target vs the "winners run / no fixed target" policy.
5. **Master-Spec citations vs its absence** (F-4) — many docs reference a source not present.

---

## 11. Recommended Fix Order (critical path first)

1. **Owner inputs (no code), to unblock faithful work:** resolve **F-5** (C-1↔C-3), **F-3** (gate posture), and supply/locate **F-4** (Master-Spec values). *(These are decisions/inputs, not new documents.)*
2. **F-9** — make EX-1 mypy-clean (completes EX-1).
3. **F-1** — implement the exit leg in order: **EX-2 → EX-3 → EX-4 → EX-5** (close execution → target close → orchestrator exit stage → end-to-end). This restores the core function and makes closed trades exist.
4. **F-8** — feed weekly-drawdown + sector exposure (and a true daily-DD) into D4 from P-ORCH.
5. **F-2** — author OR-2 fixtures (exercising HOLD/CLOSE, both engines, long/short, ≥2 regimes) and provision OR-3 PostgreSQL.
6. **Run P-VALIDATION campaign**; then address **F-6** (R-multiple persistence decision; regime linkage) and re-check **F-3** against real results.
7. **F-12 / F-7** — execute P-DEPLOY; then (owner-gated) build TradingView/IBKR for live.
8. **F-10 / F-11** — repository hygiene: separate or clearly namespace THUL-NURAYN; retire/relocate contradictory production-ready docs.

---

## 12. Exact Remediation Plan

> Each code item is purely additive and follows the established discipline (new/extended modules, no frozen-layer rewrites, tests + green suite). Items 1–3 are owner inputs (no code).

- **R-A (F-5, input):** choose Core trigger under C-3 — either fund the per-cycle Core data path (enables trend-stage) **or** redefine C-1 to regime-flip-only (marks-computable). Until chosen, Core remains hard-stop-only.
- **R-B (F-3, input):** confirm whether 0.85 WR / 2.0 PF / −10% DD stand, move, or are evaluated portfolio-level; confirm break-even offset (V-4) posture.
- **R-C (F-4, input):** supply the Master Specification (or the exit values + confirm the existing thresholds) so provisional values can be finalized.
- **R-1 (F-9):** narrow `Optional[Decimal]` after the `_usable` guard (assert/locals) in `advance_state` and `_evaluate_turbo`; re-run mypy. **XS.**
- **R-2 (F-1/EX-2):** add a D5 `ExecutionEngine` close method — create+submit closing order (NEW→SENT→FILLED), transition position OPEN→CLOSED, stamp `exit_price`/`closed_at`, `positions.update(...)`, audit; reuse existing state machines/validation. **M.**
- **R-3 (F-1/EX-3):** add `ExecutionTarget.handle_close`; PaperTarget simulates the closing fill at the supplied mark; SignalsOnly emits a close signal. **S.**
- **R-4 (F-1/EX-4):** add a P-ORCH exit stage — iterate open positions, thread `ExitState` via `advance_state`, call EX-1 `evaluate`, route CLOSE through `handle_close` → `portfolio.close_position`; honor kill-switch L1–L3 (halt only at L4); audit each evaluation. **M.**
- **R-5 (F-1/EX-5):** end-to-end test: entry → forward marks → trail/structure/hard-stop/session fires → CLOSED position → D14 counts a real closed trade + realized PnL. **S.**
- **R-6 (F-8):** compute and pass weekly-drawdown (windowed) and candidate sector exposure (D6 `sector_exposure` exists) into `RiskStateBuilder.build`; supply a true daily-DD. Add tests proving the gates bind. **M.**
- **R-7 (F-2/OR-2):** author deterministic fixtures with forward mark paths covering HOLD and CLOSE, both engines, long/short, ≥2 regimes, ≥200 round-trips; validate via in-memory dry replay. **M.**
- **R-8 (F-2/OR-3, F-12):** provision PostgreSQL + run migrations; seed operator user; set env/secrets; confirm the 24 integration tests run green. **S–M.**
- **R-9 (F-6):** decide R-multiple persistence (schema phase) or keep deferred; verify/repair regime linkage so metric 18 is attributable. **M (if persisted).**
- **R-10 (F-7):** (owner-gated, later) implement TradingView/IBKR adapters behind the existing target seam. **L.**
- **R-11 (F-10/F-11):** relocate THUL-NURAYN into its own path/repo or namespace; retire or clearly mark web-product "production-ready" docs as non-THUL. **S–M.**

---

## A. COMPLETE FIX LIST (deduplicated)

| ID | Finding | Severity | Fix |
|---|---|---|---|
| F-1 | Exit lifecycle not operational (positions never close) | **P0** | R-2, R-3, R-4, R-5 |
| F-2 | Campaign prerequisites incomplete (fixtures + PG) | **P1** | R-7, R-8 |
| F-3 | Validation gate likely unreachable as configured | **P1** | R-B (input) |
| F-4 | Master Specification absent; values unverifiable | **P1** | R-C (input) |
| F-5 | C-1 ↔ C-3 contradiction; Core structure-exit dormant | **P1** | R-A (input) |
| F-6 | D14 metric gaps (R-multiple, regime attribution) | **P1** | R-9 |
| F-8 | P-ORCH under-feeds D4 (weekly-DD, sector unbound) | **P1** | R-6 |
| F-9 | EX-1 mypy type errors | **P3** | R-1 |
| F-7 | Live trading not implemented (by design) | **P2** | R-10 (gated) |
| F-12 | P-DEPLOY not executed; provisioning unproven | **P2** | R-8 |
| F-10 | Repo hygiene (THUL-NURAYN ⟂ web product intermixed) | **P3** | R-11 |
| F-11 | Stale/contradictory "production-ready" docs | **P3** | R-11 |

*(F-7 and F-12 are deployment-class P2; they are listed after the P1 cluster because validation must precede deployment.)*

## B. Exact Implementation Order

1. **R-A, R-B, R-C** — owner inputs (resolve F-5/F-3/F-4). *No code; unblock faithful values & logic.*
2. **R-1** — EX-1 mypy clean (F-9).
3. **R-2 → R-3 → R-4 → R-5** — exit leg end-to-end (F-1). *Restores core function.*
4. **R-6** — full D4 risk feed (F-8).
5. **R-7, R-8** — fixtures + PostgreSQL provisioning (F-2/F-12).
6. **Run validation campaign** → then **R-9** (F-6) and re-evaluate F-3 against real data.
7. **R-11** — repository hygiene (F-10/F-11).
8. **R-10** — live adapters (F-7), owner-gated, after validation passes.

## C. Estimated Effort

| Item | Effort | Notes |
|---|---|---|
| R-A / R-B / R-C (inputs) | — | Owner decisions/source; no engineering time |
| R-1 (EX-1 mypy) | **XS** (~½ hr) | Type narrowing only |
| R-2 (EX-2 close exec) | **M** (1–2 d) | New D5 method + tests |
| R-3 (EX-3 target close) | **S** (~½ d) | Paper close path + tests |
| R-4 (EX-4 orch exit stage) | **M** (1–2 d) | Exit stage + kill-switch handling + audit + tests |
| R-5 (EX-5 E2E) | **S** (~½ d) | Integration test |
| R-6 (F-8 risk feed) | **M** (1 d) | Weekly-DD window + sector relay + tests |
| R-7 (OR-2 fixtures) | **M** (1–2 d) | Deterministic dataset + dry-replay validation |
| R-8 (OR-3 PG + deploy) | **S–M** (½–1 d) | Infra/env/seed; run skipped tests |
| R-9 (F-6 metrics) | **M** (1–2 d) | Only if R-multiple is persisted (schema) |
| R-11 (repo hygiene) | **S–M** (½–1 d) | Relocate/namespace + doc cleanup |
| R-10 (live adapters) | **L** (weeks) | Owner-gated; out of current scope |

**Critical path to a runnable paper-validation campaign:** R-1 → R-2 → R-3 → R-4 → R-5 → R-6 → R-7 → R-8 ≈ **~6–9 engineering days**, plus the three owner inputs (R-A/R-B/R-C) which gate *faithful* (vs provisional) values. Live deployment (R-10) is a separate, later, owner-gated track.

---

*End of MASTER_PROGRAM_AUDIT. This is the sole deliverable; no further reports, matrices, or decision documents will be produced.*
