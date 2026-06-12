# FIRST_PAPER_CAMPAIGN_READINESS_REVIEW

**Type:** Architecture & operational readiness review for the **first autonomous paper-trading validation campaign**. **Review only — no code, no implementation, no new features.**
**Verified from source:** full test run, env/seed prerequisites, entrypoint wiring, fixtures.
**Repo state:** branch `claude/new-session-qmyh4r` · D14 closed (`4847d20`) · **389 passed / 24 skipped**.

---

## 1. Paper-Run Readiness Review
| Capability | Status | Evidence |
|------------|--------|----------|
| Domain engines D1–D6 | ✅ Ready | implemented, audited, frozen |
| B7 persistence / B8 operations / B9 integration+recovery | ✅ Ready | implemented, audited |
| P-SIZE (fixed allocation, non-finite-hardened) | ✅ Ready | 42 tests |
| P-DATA (Replay/Fixture provider) | ✅ Ready (code) | 19 tests — **but no fixtures exist (§7)** |
| P-ORCH (autonomous conductor) | ✅ Ready | 15 tests; full chain incl. kill-switch/data-quality/audit |
| D14 measurement (metrics/reports/gate) | ✅ Ready | 17 tests |
| Paper target (D11) | ✅ Ready | `broker_ref="paper:"`; no broker |
| **Runnable composition entrypoint** | ❌ **MISSING** | bootstrap() composes engines but does **not** wire `ReplayMarketDataProvider` + `PipelineOrchestrator` + `TradingCycleWorker` + Paper target into the scheduler; **no `main`/entrypoint exists** |
| End-to-end loop proven | ✅ in-memory unit | `test_end_to_end_paper_cycle`; **not** as a running process |

**Assessment:** every *component* is ready; the **assembled, runnable application is not** — there is no entrypoint that starts an autonomous loop.

## 2. Deployment Readiness Review
| Item | Status |
|------|--------|
| Deployment architecture (P-DEPLOY) | ✅ approved |
| `db/apply_schema.py` + frozen schema | ✅ present |
| **PostgreSQL provisioned** | ❌ **not provisioned** (24 DB-integration tests skip; only in-memory verified) |
| Monthly partitions provisioned | ❌ pending (B8 detect-only; external ops step) |
| Seed data (`instruments`/`sectors`/operator `users`) | ❌ not seeded |
| Env vars (`DATABASE_URL`, `STARTING_CAPITAL`, `POSITION_ALLOCATION_FRACTION`, `EXECUTION_TARGET=paper`) | ❌ not set in a deploy env |
| Redis (optional) | ✅ degraded-safe; not required |
| Logging + secret redaction | ✅ available |
| Monitoring / backup | ✅ defined (P-DEPLOY) — not yet operationally stood up |

**Assessment:** deployment is **architected but not provisioned**.

## 3. Validation Readiness Review
| Item | Status |
|------|--------|
| Owner Validation Policy encoded | ✅ `ValidationThresholds` defaults (30d/200/85%/PF2.0/DD10/return/recovery/2 regimes/long+short) |
| Daily/weekly/monthly + cumulative reporting | ✅ `ValidationReporter` (D14) |
| Pass/Fail gate (read-only eligibility) | ✅ `evaluate()` |
| Regime coverage (≥2) | ⚠️ Derived from `scan` audit events — **depends on fixtures spanning ≥2 regimes** (§6/§7); per-trade regime not attributed (documented) |
| Long/Short coverage | ⚠️ Computable — **depends on fixtures generating both** (§7) |
| R-multiple | ⚠️ Proxy only (no per-trade risk basis; OD-D14-1) — reporting-only |

**Assessment:** measurement is **ready**; whether the campaign can *satisfy* coverage gates depends entirely on the **fixture data** (which does not yet exist).

## 4. Open Risks Review (severity-ordered)
| # | Risk | Severity | Note |
|---|------|----------|------|
| OR-1 | **No runnable composition entrypoint** — the autonomous loop cannot be launched | **High (blocker)** | components exist; assembly/`main` does not |
| OR-2 | **No market-data fixtures** for the Replay provider | **High (blocker)** | provider has nothing to replay |
| OR-3 | **PostgreSQL not provisioned** — no durable/recoverable/validatable campaign | **High (blocker)** | in-memory ≠ a real 30-day campaign; 24 DB tests unrun |
| OR-4 | Coverage feasibility (≥2 regimes, long+short, ≥200 trades over ≥30d) hinges on fixture breadth | Medium | fixture design requirement |
| OR-5 | P-ORCH **weekly-DD/sector risk inputs default to 0** (input-relay limitation) | Medium (documented) | D4 daily-DD/kill-switch/max-open/trades/consec-loss fully fed; weekly-DD/sector under-fed; not a rule change |
| OR-6 | Regime **per-trade** attribution not persisted | Low (documented) | coverage via audit events satisfies the gate; per-trade breakdown unattributed |
| OR-7 | Fixture-driven validation ≠ live market behavior | Medium (by design) | paper/fixtures validate the *pipeline*; live realism is D7/future |

## 5. Missing Prerequisites Review (must-haves before a run)
1. **Composition entrypoint / runnable `main`** assembling: `bootstrap()` → `make_execution_target("paper")` → `SizingPolicy`+`CapitalSettings.from_env()` → `ReplayMarketDataProvider(fixtures)` → `PipelineOrchestrator.from_application(...)` → `TradingCycleWorker` → `scheduler.register(...)` → `application.start()`. *(Small wiring; **implementation work not yet authorized/done**.)*
2. **Market-data fixtures** (deterministic) with sufficient breadth (§6/§7).
3. **Provisioned PostgreSQL** + `apply_schema.py` + current/upcoming partitions + seed (`instruments`/`sectors`/operator `users`).
4. **Environment configuration** (the four required env vars; `EXECUTION_TARGET=paper`).
5. **24 DB-integration tests run green** against the provisioned PostgreSQL.
6. **Monitoring/backup operationally stood up** (per P-DEPLOY).

## 6. Data Requirements Review
For the campaign to be **measurable against the policy**, the data must yield:
- **≥ 200 closed paper trades** over **≥ 30 trading days** (sample + duration).
- **≥ 2 market regimes** — fixtures must drive SPY into **Bull** *and* a non-Bull (Bear/Sideways) regime (D3 RegimeEngine classifies; orchestrator emits `scan` events D14 reads for coverage).
- **Both Long and Short** candidates — Core (long-only, bull-gated) **and** Turbo (long/short) candidate facts, including Short-in-Bear, so both directions produce closed positions.
- **Per-candidate marks** for every traded symbol (for paper fills) + sufficient fact breadth so D3 accepts and D4 passes a realistic mix.
- **Seeded `instruments`** matching every fixture symbol (orchestrator skips unknown symbols).
- Marks/prices that produce a **realistic PnL distribution** (wins and losses) so win-rate/PF/drawdown/recovery are meaningfully exercised.

## 7. Fixture / Replay Coverage Review
| Requirement | Present? |
|-------------|----------|
| Any committed fixtures | ❌ **None** (no fixture/CSV/replay dataset in the repo) |
| Bull-regime SPY fixtures | ❌ |
| Non-Bull (Bear/Sideways) SPY fixtures | ❌ |
| Core long candidates | ❌ |
| Turbo long + short candidates | ❌ |
| ≥200 trades / ≥30 trading-day breadth | ❌ |
| Per-symbol marks aligned to candidates | ❌ |

**Assessment:** **fixture coverage is 0%.** A deterministic fixture set spanning ≥2 regimes, both directions, and ≥30 days / ≥200 plausible trades must be authored before a campaign can run or satisfy the policy gates.

## 8. Operational Runbook (first campaign — when prerequisites are met)
**Provision**
1. Stand up PostgreSQL (+ optional Redis); set `DATABASE_URL`.
2. `python db/apply_schema.py`; create current/upcoming month partitions.
3. Seed `sectors`/`instruments` (all fixture symbols) + operator `users` row.
4. Set `STARTING_CAPITAL`, `POSITION_ALLOCATION_FRACTION`, `EXECUTION_TARGET=paper`.
5. Run full suite incl. the 24 DB tests → all green.

**Launch**
6. Start the process → `bootstrap()` (health-gated; aborts if PG down) → B9 recovery → `ServiceStarted`.
7. Composition entrypoint wires provider+orchestrator+target+`TradingCycleWorker` into the scheduler.
8. Operator verifies recovered state (portfolio/kill-switch level via metrics).
9. Record `campaign_start`; **explicit `application.start()`** begins the loop.

**Daily** (P-VALIDATION §3)
10. Health check → confirm cycles ran → DLQ review (manual) → daily `ValidationReport` + `performance_records` → cumulative update → gate check → partition/backup check → operator sign-off.

**Escalation** (P-VALIDATION §7)
11. DD>10% / system-defect D4 breach / L3-L4 system error / unresolved execution DLQ → **FAIL**; PG down → pause clock; Redis down → DEGRADED.

**Completion**
12. When ≥30 days **and** ≥200 trades → evaluate full Pass/Fail (`evaluate(cumulative_report)`); record outcome durably; on FAIL forward-only rollback (history preserved); on PASS compile live-eligibility evidence (live remains separately gated).

**Shutdown**
13. `application.shutdown()` → stop scheduler → settle DAL work → `ServiceStopped` → close pool.

## 9. Go / No-Go Recommendation

### 🔴 **NO-GO** (for launching the first durable validation campaign now)

**Justification (from source):**
- **OR-1 (blocker):** there is **no runnable composition entrypoint** — `bootstrap()` does not wire the orchestrator/provider/target/scheduler, and no `main` exists. The autonomous loop cannot be started as a process today.
- **OR-2 (blocker):** **no market-data fixtures** exist — the Replay provider has nothing to replay; the policy's coverage gates (≥2 regimes, long+short, ≥200 trades/≥30d) cannot be met without them.
- **OR-3 (blocker):** **PostgreSQL is not provisioned** — only in-memory behavior is verified (24 DB-integration tests skip). A 30-day, recoverable, durable campaign requires the real database, schema, partitions, and seed data.

**What IS ready (not the blocker):** all domain + integration phases (D1–D6, B7–B9, P-SIZE, P-DATA, P-ORCH, D14) are implemented, independently audited, frozen, and green (389 in-memory tests); recovery, kill-switch, data-quality, audit, and the validation measurement/gate are all verified. The architecture is GO-quality.

**Path to GO (no new features — composition + provisioning + data only):**
1. Author the **composition entrypoint** (small wiring of existing components; owner-authorized implementation).
2. Author the **deterministic fixture set** (≥2 regimes, long+short, ≥30d/≥200-trade breadth) + seed matching instruments.
3. **Provision PostgreSQL** (schema + partitions + seed + env); run the 24 DB tests green.
4. Stand up monitoring/backup per P-DEPLOY.
5. Re-run this readiness review → expect **GO**.

> Net: the **engine is ready; the launch is not**. Flipping to GO requires three owner-authorized operational steps (entrypoint wiring, fixtures, PostgreSQL provisioning) — none of which is a new feature or a change to any frozen layer.

---

## 10. Stop Gate
**STOP.**

Architecture & operational review only — no code, no implementation, no new features. **Recommendation: NO-GO** until the three blockers (entrypoint, fixtures, PostgreSQL provisioning) are resolved. Await owner direction on authorizing those operational steps. Do not begin D14A, TradingView, IBKR, or Live Trading.
