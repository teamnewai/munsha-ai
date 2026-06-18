# COMPOSITION_ENTRYPOINT_ARCHITECTURE

**Type:** Pre-implementation architecture review. **Architecture only — no code, no implementation, no new features.**
**Derived from (source-verified signatures):** `bootstrap()` / `Application.start|shutdown` (B9) · `make_execution_target` (D11) · `CapitalSettings.from_env` / `SizingPolicy` (P-SIZE) · `ReplayMarketDataProvider` (P-DATA) · `PipelineOrchestrator.from_application` / `TradingCycleWorker` (P-ORCH) · `Scheduler.register` (B8).
**Status:** Architecture only — implementation forbidden until owner approval.
**Phase:** Composition Entrypoint — the runnable assembly that resolves blocker **OR-1** from `FIRST_PAPER_CAMPAIGN_READINESS_REVIEW`.

**Invariants preserved:** PostgreSQL **sole source of truth** · Redis **non-authoritative** · Portfolio ⟂ Risk ⟂ Execution · **no strategy / risk / execution / schema changes · no new features · no TradingView · no IBKR · no live trading** · **reuse existing approved components only**. The entrypoint is **wiring + lifecycle only** — it adds no logic and modifies no prior layer.

---

## 1. Entrypoint Architecture

A single **composition root** (planned `src/app/run.py`) that assembles already-built components into a runnable `Application` and exposes a thin lifecycle. It is the *only* place that constructs the provider + orchestrator + target + worker and registers them with the scheduler; everything it touches is an existing public API.

```
   run.py  (NEW — composition + lifecycle only)
     │ reads env (no secrets in code)
     ▼
   bootstrap()                         [B9]  → Application (engines + ops + DAL + recovery)
     │
     ├─ make_execution_target("paper", …)        [D11]  → PaperTarget (no broker)
     ├─ SizingPolicy() + CapitalSettings.from_env()[P-SIZE]
     ├─ ReplayMarketDataProvider(fixtures)        [P-DATA] (deterministic; no vendor)
     ├─ PipelineOrchestrator.from_application(app, target, sizing, capital, user)[P-ORCH]
     ├─ TradingCycleWorker(orchestrator, provider) [P-ORCH]
     │     └─ app.scheduler.register(worker)       [B8]   (registered, NOT started)
     ▼
   Application (composed + recovered, NOT started)
     │  operator → application.start()             [B9 OD-D6] begins the loop
     │  operator → application.shutdown()          [B9] graceful stop
```

**Design rules:**
- **Reuse only:** no new domain/analytics class; only construction calls to existing components.
- **No auto-start:** the entrypoint composes and registers; the loop begins **only** on explicit `application.start()` (B9 OD-D6).
- **Paper-only:** `EXECUTION_TARGET` must resolve to `paper` (or `signals`); `ibkr`/`tradingview` raise `NotImplementedError` (D11) — the entrypoint does not bypass that.
- **No fixtures embedded:** the entrypoint *loads* a fixture source (path via config) for the Replay provider; authoring fixtures is the separate **OR-2** blocker, not this phase.

> **Owner decision (placement):** `src/app/run.py` as an additive module (recommended), exposing a `compose() -> Application` function and an optional `__main__` guard for `python -m src.app.run`. No existing file is modified (the orchestrator/target/provider are wired *here*, not inside `bootstrap`).

---

## 2. Startup Sequence
1. **Config/logging** — `configure_logging()`; read env (`DATABASE_URL`, `STARTING_CAPITAL`, `POSITION_ALLOCATION_FRACTION`, `EXECUTION_TARGET`, optional `DB_POOL_*`/`REDIS_*`/`OPS_*`, fixture path). No secrets in code.
2. **bootstrap()** [B9] — builds `ConnectionPool` (health-gated; raises `PersistenceError` if PostgreSQL unreachable) + `RedisClient` + `PostgresDataAccessLayer`, B8 operations, **runs B9 recovery** (kill-switch → portfolio → duplicate-protection → risk-state → warm Redis), registers B8 workers, emits `ServiceStarted`. Returns a **not-yet-started** `Application`.
3. **Capital/sizing** — `CapitalSettings.from_env()` (raises on missing/unparseable/non-finite); `SizingPolicy()`.
4. **Execution target** — `make_execution_target("paper", dal=app.dal)` → PaperTarget (no broker).
5. **Market data** — `ReplayMarketDataProvider(load_fixtures(path), clock=…, max_age_sec=…)` (deterministic; no vendor/network).
6. **Orchestrator** — `PipelineOrchestrator.from_application(app, execution_target=target, sizing_policy=…, capital_settings=…, operator_user_id=<from config>, clock=…)`.
7. **Register worker** — `TradingCycleWorker(orchestrator, provider, interval=…)`; `app.scheduler.register(worker)`. **Do not start.**
8. **Return** the composed, recovered `Application` to the operator.
9. **Explicit start** — operator calls `application.start(tick_sec=…)` after verifying recovered state → the autonomous paper loop runs (B8 scheduler; per-cycle failure isolation).

## 3. Shutdown Sequence
Reuses `Application.shutdown()` [B9] (reverse of startup):
1. `scheduler.stop()` — finishes the current tick; runs no new cycles.
2. In-flight DAL work settles/rolls back atomically (B7 transactions).
3. Emit `ServiceStopped` (B8 `HeartbeatEmitter`).
4. `ConnectionPool.close()`; Redis released.
Idempotent; **no domain rows** written beyond `ServiceStopped`; **no data loss** (all durable state in PostgreSQL; Redis discarded).

## 4. Recovery Sequence
Recovery is **B9's** (already built) — the entrypoint **invokes it via `bootstrap()`**, it does not reimplement it:
- B9 read-only rebuild from PostgreSQL (ratified order): **kill-switch level → PortfolioState → DuplicateOrderProtection → RiskState inputs → warm Redis.**
- Marks are **cold**; the Replay provider re-supplies them on the next cycle.
- **No duplicate actions:** in-flight (`New`/`Sent`) fingerprints re-registered; the orchestrator holds no durable cycle state → fresh cycles against recovered state.
- A `Recovery` audit event records what was restored. **Crash-restart ≡ graceful restart.**
The entrypoint's role on restart: re-run `compose()` (which calls `bootstrap()`), then await explicit `start()`.

## 5. Error Handling
| Condition | Behavior (reusing existing fail-safe) |
|-----------|----------------------------------------|
| PostgreSQL unreachable at startup | `bootstrap()`/`ConnectionPool` raises `PersistenceError` → entrypoint **aborts** (process exits non-zero); no partial start |
| Missing/invalid required env (`STARTING_CAPITAL`, allocation) | `CapitalSettings.from_env()` raises `ValueError` → abort before composing the loop |
| `EXECUTION_TARGET` = ibkr/tradingview | `make_execution_target` raises `NotImplementedError` → abort (paper-only enforced) |
| Fixtures missing/unreadable | entrypoint raises a clear config error → abort (no fabricated data) |
| Redis unreachable | non-fatal → DEGRADED; entrypoint continues |
| Per-cycle failure after start | **B8 scheduler isolation** — recorded as `WorkerFailure` + dead-lettered; loop survives (no entrypoint logic) |
| Data-quality fatal frame | **P-ORCH** Reject-Cycle path (alert + DLQ + No-Trade); entrypoint does nothing special |
| Signal/abort (operator stop) | route to `application.shutdown()` (graceful) |

The entrypoint adds **no new error semantics**; it surfaces existing fail-safe behavior and aborts cleanly on misconfiguration.

## 6. Dependency Map
```
                         run.py (composition root, NEW)
   ┌──────────────┬───────────────┬──────────────┬───────────────┬─────────────┐
   ▼              ▼               ▼              ▼               ▼             ▼
 bootstrap()   make_exec_     SizingPolicy/   ReplayMarket   PipelineOrch.   TradingCycle
 (B9)          target("paper")CapitalSettings DataProvider   from_application Worker
   │            (D11)          (P-SIZE)        (P-DATA)        (P-ORCH)        (P-ORCH)
   ▼                                                                            │
 Application(B9): DAL · ops(B8) · engines(D3/D4/D6) · portfolio · ks-cache      │
   │  scheduler(B8).register(worker) ◄───────────────────────────────────────-─┘
   ▼
 PostgreSQL (truth) ·  Redis (non-authoritative)
```
`run.py` depends **downward** on all approved components and is depended on by none. **No new third-party dependency.** No engine/strategy/risk/execution code is added or modified.

## 7. Operational Flow (one launch)
```
 operator: set env (EXECUTION_TARGET=paper, capital, allocation, DATABASE_URL, fixture path)
   → python -m src.app.run  (or call compose())
       → bootstrap(): health-gated start + B9 recovery + ServiceStarted
       → wire paper target + sizing + Replay provider + orchestrator + worker
       → scheduler.register(worker)   [NOT started]
   → operator verifies recovered state (metrics/health)
   → application.start(tick_sec)      → autonomous paper cycles begin
       (each tick: P-DATA → kill-switch → data-quality → D3 → D4 → P-SIZE → Paper → D6 → audit)
   → daily ops + validation reporting (D14)  [separate procedures]
   → application.shutdown()           → ServiceStopped + pool close
```

## 8. Definition of Done
1. `src/app/run.py` (additive) exposing `compose() -> Application` (+ optional `__main__`), constructing **only** existing components.
2. Startup sequence (§2) implemented exactly; **no auto-start** (explicit `application.start()`).
3. Paper-only enforced via `make_execution_target` (ibkr/tradingview → `NotImplementedError`); **no broker/TradingView/IBKR/live**.
4. Recovery delegated to `bootstrap()`/B9 (not reimplemented); restart = re-`compose()` + explicit start; no duplicate actions.
5. Shutdown delegated to `Application.shutdown()`; idempotent; no data loss.
6. Error handling (§5): aborts on PG-unreachable / bad env / non-paper target / missing fixtures; DEGRADED on Redis; per-cycle failures isolated by B8.
7. Config-driven (env + fixture path); **no secrets in code**; no hardcoded capital/allocation.
8. **No strategy/risk/execution/allocation/schema change; no new feature; reuse-only** — verified by an additive diff (no modification to D1–D14A / P-SIZE / P-DATA / P-ORCH / B9 files).
9. Tests (at implementation): `compose()` wires the graph; not-started until `start()`; paper-only enforced; abort paths (PG down via injected failing pool, bad env, non-paper target, missing fixtures); an in-memory smoke run of one cycle via the composed app + a degraded-Redis path; full suite stays green.
10. `COMPOSITION_ENTRYPOINT_BUILD_REPORT.md` produced; stop at the gate.

## 9. Out of Scope
- Authoring market-data fixtures (blocker **OR-2**, separate).
- PostgreSQL provisioning (blocker **OR-3**, operational).
- Any change to D1–D14A / P-SIZE / P-DATA / P-ORCH / B9 logic.
- TradingView, IBKR, live trading, new features, schema changes.
- A full CLI/API/UI (only a minimal `compose()` + optional `__main__`).

## 10. Stop Gate
**STOP.**

Architecture only — no code, no implementation, no new features; reuse of existing approved components only. Await owner approval before implementing the composition entrypoint. Do not author fixtures (OR-2), provision PostgreSQL (OR-3), or begin TradingView/IBKR/Live Trading.
