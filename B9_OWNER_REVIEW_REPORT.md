# B9_OWNER_REVIEW_REPORT

**Type:** Architecture review for owner decision. **No code. No tests. No implementation.**
**Reviews:** `B9_INTEGRATION_ARCHITECTURE.md` (19 sections) · `B9_ARCHITECTURE_SUMMARY.md`.
**Phase under review:** B9 — Integration & Recovery.
**Project state:** B1–B8 approved/frozen · 254 passed / 23 skipped @ `200e9bf`.
**Purpose of this report:** give the owner everything needed to approve, amend, or reject B9 before any code is written.

---

## 1. Section-by-Section Summary, Purpose, and Change Footprint

For each architecture section: **what it says**, **why it exists**, and **what is added / rebuilt / unchanged**.

### §1 Purpose
- **Summary:** B9 composes D1–D6 (domain) + B7 (persistence) + B8 (operations) into one runnable application and defines transient-state recovery from PostgreSQL.
- **Purpose:** Deliver the single integration layer that earlier phases deferred to B9.
- **Added:** an integration layer (wiring + rebuild glue). **Rebuilt:** nothing yet (declared). **Unchanged:** all domain logic — B9 adds none.

### §2 Scope
- **Summary:** In scope = `src/app/` (bootstrap + recovery), startup ordering, dependency wiring, four rebuilds, scheduler start/stop, health-gated startup, E2E wiring with a mock broker. Out of scope = any D1–D8 modification, schema/table/enum changes, strategy/risk/execution/sizing changes, broker connectivity, API/UI, async, auto-retry.
- **Purpose:** Draw a hard boundary so integration cannot leak into domain changes.
- **Added:** `src/app/` package + integration tests. **Rebuilt:** (declared, see §7–§10). **Unchanged:** D1–D8 source.

### §3 Application Bootstrap
- **Summary:** A single composition root assembles the object graph in dependency order (config/logging → infra → DAL → operations → recovery → engines → scheduler) and returns an `Application` handle.
- **Purpose:** One place that knows concrete backends; everyone else gets interfaces.
- **Added:** `bootstrap.py`, `Application` wiring container. **Rebuilt:** invokes recovery. **Unchanged:** every constructed object is an existing phase's class, used as-is. Only operational write during bootstrap is `ServiceStarted`.

### §4 Dependency Wiring
- **Summary:** Exactly one `PostgresDataAccessLayer` is shared by D5 audit, D6 `persist_stats`, B8 writers, and structural lookups. Table maps each consumer to its injected dependency. B9 provides two **read-only** `pg_catalog` readers to back the B8 partition detector / retention lister.
- **Purpose:** Make all writes durable and all reads consistent through one DAL.
- **Added:** wiring + two read-only catalog readers. **Rebuilt:** `DuplicateOrderProtection` injected into D5. **Unchanged:** every engine constructor signature; no engine internals touched.

### §5 PostgreSQL Recovery Flow
- **Summary:** Generic recovery contract — confirm PostgreSQL reachable, read durable facts via DAL (no writes), replay via existing D5/D6 public methods, surface inconsistencies as alert + DLQ.
- **Purpose:** A uniform, read-only, non-destructive recovery discipline.
- **Added:** `recovery.py`. **Rebuilt:** the four aggregates (§6–§10). **Unchanged:** domain rows are never mutated.

### §6 Redis Cold-Start Recovery
- **Summary:** Redis is cold on restart; B9 reads no app state from Redis; after PostgreSQL rebuilds it **warms** the kill-switch and DLQ caches from PostgreSQL; if Redis is down, warming is skipped (DEGRADED).
- **Purpose:** Guarantee Redis is never authoritative and never a startup dependency.
- **Added:** cache-warming step. **Rebuilt:** Redis caches (from PostgreSQL). **Unchanged:** Redis remains non-authoritative.

### §7 PortfolioState Rebuild (D6)
- **Summary:** Construct `PortfolioState(starting_capital)`, replay **closed** positions (`open_position`→`close_position`) then **open** positions (`open_position`); result `cash = starting_capital + Σ realized PnL`.
- **Purpose:** Recover portfolio cash + open registry exactly as live trading produced it.
- **Added:** rebuild routine. **Rebuilt:** `PortfolioState`. **Unchanged:** D6 — only its public methods are called; PnL/equity/drawdown still computed by D6 later at `snapshot(marks)`.

### §8 DuplicateOrderProtection Rebuild (D5)
- **Summary:** Construct `DuplicateOrderProtection()`, `register(order)` for every `New`/`Sent` order; terminal orders not registered.
- **Purpose:** Keep duplicate protection intact across restart (replayed signals still rejected).
- **Added:** rebuild routine. **Rebuilt:** `DuplicateOrderProtection`. **Unchanged:** D5 fingerprint logic (B9 calls it, never reimplements it).

### §9 RiskState Rebuild (D4)
- **Summary:** A **RiskState builder** assembles D4's expected input fields (kill-switch level, open positions, trades today, drawdowns from D6, monthly pause, consecutive losses, candidate sector exposures) read-only at decision time.
- **Purpose:** Feed D4 the inputs it already requires after a restart.
- **Added:** RiskState builder (input assembly only). **Rebuilt:** risk *inputs* (not a stored aggregate). **Unchanged:** D4 thresholds, gates, ordering, decisions — **no rule change**. Separation D6 computes ⟂ D4 decides preserved.

### §10 Kill-Switch Cache Rebuild (B8)
- **Summary:** Call `KillSwitchLevelCache.rebuild()` to recover the level from the latest `KillSwitchActivated` row; repopulate Redis; treat level as integer data (no D4 enum import); B9 never sets the level.
- **Purpose:** Recover the operator/D4-decided kill-switch level after restart.
- **Added:** invocation at startup. **Rebuilt:** kill-switch cache. **Unchanged:** B8 `KillSwitchLevelCache`; level decision remains D4/owner's.

### §11 Scheduler Startup
- **Summary:** Construct B8 `Scheduler`, register `HealthPoller`, `DLQMonitor`, `MissingPartitionDetector` (detect-only), `RetentionTierer` (read-only); emit `ServiceStarted`; start the existing daemon loop **after** recovery.
- **Purpose:** Turn on background operations against a consistent rebuilt state.
- **Added:** registration + start sequencing. **Rebuilt:** n/a. **Unchanged:** B8 scheduler/workers and their failure-isolation behavior.

### §12 Health State Transitions
- **Summary:** Wire B8 `HealthMonitor`; startup RUNNING (PG+Redis up) or DEGRADED (Redis down); runtime `HealthPoller` emits one event per component transition; operational state computed observationally.
- **Purpose:** Surface system health without B9 inventing health logic.
- **Added:** wiring + surfacing. **Rebuilt:** n/a. **Unchanged:** B8 health logic; B9 never pauses/halts trading (that's D4/D5).

### §13 Failure Recovery Rules
- **Summary:** Table of conditions → response → authority: PG down at startup ⇒ abort; Redis down ⇒ DEGRADED; PG lost mid-op ⇒ propagate + dead-letter; rebuild inconsistency ⇒ alert + DLQ + continue with consistent subset; worker failure ⇒ recorded + dead-lettered; L4 ⇒ operational SHUTDOWN surfaced; no auto-retry.
- **Purpose:** Define deterministic, non-destructive failure handling.
- **Added:** orchestration of existing fail-safe paths. **Rebuilt:** n/a. **Unchanged:** B7/B8 fail-safe mechanisms; domain rows never repaired.

### §14 Graceful Shutdown
- **Summary:** Reverse order — stop scheduler, settle in-flight DAL work, emit `ServiceStopped`, close pool; idempotent; no data loss.
- **Purpose:** Clean stop with all durable state already in PostgreSQL.
- **Added:** shutdown path. **Rebuilt:** n/a. **Unchanged:** B7 transaction guarantees; only operational `ServiceStopped` written.

### §15 Restart Semantics
- **Summary:** Crash ≡ graceful restart (PG truth + cold Redis); recovery idempotent/deterministic/read-only; in-flight `New`/`Sent` re-registered; repeated `ServiceStarted` harmless; no partition auto-provisioning on restart.
- **Purpose:** Guarantee convergent, drift-free restarts.
- **Added:** restart guarantees (properties of the above). **Rebuilt:** all four aggregates each restart. **Unchanged:** `Sent`-order broker reconciliation deferred to D7/owner.

### §16 End-to-End Component Diagram
- **Summary:** Visual of bootstrap constructing infra/operations/recovery, single DAL to PostgreSQL (truth), Redis warmed from PG, and the Signal→Score→Risk→Execution→Fill→Portfolio pipeline with mock broker boundary.
- **Purpose:** One picture of composition + separation.
- **Added/Rebuilt/Unchanged:** documentation only.

### §17 Definition of Done
- **Summary:** 18 acceptance criteria (package present, health-gated startup, four rebuilds correct, scheduler start/stop, observational health, graceful shutdown, idempotent restart, E2E with mock broker, D1–D8 unmodified, all 254 tests green + new B9 tests, no secrets, invariants preserved, build report).
- **Purpose:** Objective B9 gate.

### §18 Assumptions
- **Summary:** 12 explicit assumptions (see §4 of this report).
- **Purpose:** Make every premise auditable.

### §19 Stop Gate
- **Summary:** STOP; architecture only; await approval.
- **Purpose:** Enforce the review gate.

---

## 2. What Is Added / Rebuilt / Unchanged (consolidated)

**Added (new in B9):**
- `src/app/` package: composition root (`bootstrap.py`) + recovery (`recovery.py`).
- An `Application` wiring container (plain object; not persisted, not a domain entity).
- A **RiskState builder** (input assembly for D4).
- Two **read-only `pg_catalog` readers** backing the B8 partition detector and retention lister.
- A **mock/in-memory `BrokerSyncContract`** implementation for E2E (no network).
- B9 integration/E2E tests.

**Rebuilt (read-only, from PostgreSQL, each startup):**
- `PortfolioState` (D6) — from closed + open `positions` + `starting_capital`.
- `DuplicateOrderProtection` (D5) — from `New`/`Sent` `orders`.
- `RiskState` inputs (D4) — assembled at decision time.
- Kill-switch level cache (B8) — from latest `KillSwitchActivated`.
- Redis caches (kill-switch level, DLQ index) — warmed from PostgreSQL.

**Unchanged (zero modification):**
- D1 enums/models/schema; D2 DAL/repository; D3 selection; D4 risk rules; D5 execution/state machines/fingerprint; D6 portfolio analytics; B7 persistence; B8 operations.
- All thresholds, gates, score weights, state-machine rules, sizing (fixed 10%/trade, V2-001 untouched).

---

## 3. Startup / Recovery / Rebuild Steps — Exact Order

**Startup (bootstrap §3 + scheduler §11):**
1. Load `OperationsConfig.from_env()`; `configure_logging()` (secrets redacted).
2. Construct `ConnectionPool` (B7) — startup health check; **abort with `PersistenceError` if PostgreSQL unreachable**.
3. Construct `RedisClient` (B7) — non-fatal; degraded if down.
4. Construct single `PostgresDataAccessLayer(pool)`.
5. Construct B8 operations: `AlertManager`, `DeadLetterQueue`, `KillSwitchLevelCache`, `HealthMonitor`, `MetricsCollector` (+ later `Scheduler`).
6. **Recovery (read-only):**
   - 6a. Rebuild kill-switch cache → `KillSwitchLevelCache.rebuild()` (§10).
   - 6b. Rebuild `PortfolioState` → replay **closed** positions (`open_position`→`close_position`), then **open** positions (`open_position`) (§7).
   - 6c. Rebuild `DuplicateOrderProtection` → `register()` each `New`/`Sent` order (§8).
   - 6d. RiskState builder ready (assembles D4 inputs on demand) (§9).
7. **Warm Redis caches from PostgreSQL** (kill-switch level; DLQ index) — skipped if Redis down (§6).
8. Construct domain engines (D3 `SelectionEngine`, D4 `RiskDecisionEngine`, D5 `ExecutionEngine` with rebuilt `DuplicateOrderProtection` + mock broker, D6 rebuilt `PortfolioState`) (§4, §6 step 6).
9. Register B8 workers + emit `ServiceStarted`; `scheduler.start()` — **after** recovery (§11).

> Note: the architecture lists kill-switch rebuild as §10 and Portfolio/DuplicateOrder as §7/§8. The exact intra-recovery ordering above (kill-switch first, so it is available to the RiskState builder) is the reviewer's reading of the dependency order; **Owner Decision D4** asks the owner to confirm the precise recovery sub-order.

**Shutdown (§14), reverse:**
1. `scheduler.stop()`. 2. Settle in-flight DAL work (B7 atomicity). 3. Emit `ServiceStopped`. 4. `ConnectionPool.close()`; release Redis.

**Restart (§15):** = Startup (steps 1–9); deterministic, idempotent, read-only; crash ≡ graceful.

---

## 4. Every Assumption (architecture §18)

| # | Assumption | Reviewer note |
|---|-----------|---------------|
| A1 | B9 adds new `src/app/` package; orchestrates D1–D8, modifies none | Mirrors B8 adding `src/operations/` |
| A2 | `starting_capital` is configuration (env/config), not persisted | Consistent with B6 assumption 9; **see Owner Decision D1** |
| A3 | Marks not part of rebuild; supplied at `snapshot(marks)` time | D6 never fetches prices |
| A4 | `trades_today` from `orders.created_at` vs a **UTC** trading-day window | **See Owner Decision D2** (market-calendar boundary) |
| A5 | `consecutive_losses` derived read-only (win = PnL>0, loss = PnL≤0) | Per B6 assumption 11 |
| A6 | Broker boundary = **mock** only (no network, no D7) | **See Owner Decision D3** |
| A7 | `pg_catalog` readers are read-only `SELECT` | Honors A2 (detect-only) |
| A8 | Recovery non-destructive; inconsistencies → alert + DLQ, never repaired | **See Owner Decision D5** |
| A9 | Single process, synchronous; B8 daemon-thread scheduler; HA out of scope | No async |
| A10 | Repeated `ServiceStarted` on restart is harmless (append-only) | Latest-row-wins / DLQ keyed by id |
| A11 | No automatic retry; manual DLQ resolution | Consistent with B5/B7/B8 |
| A12 | In-memory DAL is default test backend; PG E2E behind `DATABASE_URL` | Consistent with B7/B8 test strategy |

---

## 5. Every Trade-off

| # | Trade-off | Chosen | Cost |
|---|-----------|--------|------|
| T1 | Recovery non-destructive vs auto-repair | Non-destructive (alert + DLQ) | Operator must resolve inconsistencies manually |
| T2 | PortfolioState rebuild by full replay vs snapshot table | Full replay of all positions | O(N positions) startup cost; no new table (preserves freeze) |
| T3 | RiskState assembled on demand vs stored | On-demand read-only build | Repeated reads at decision time; always fresh, no drift |
| T4 | Broker = mock only vs real adapter | Mock (E2E only) | No live/paper trading in B9; full pipeline still verified |
| T5 | Redis cold + warm-from-PG vs Redis-as-cache-of-record | Cold + warm from PG | Extra warm step; guarantees PG authority |
| T6 | Single synchronous process vs async/HA | Synchronous, single process | No horizontal scale in v1; matches frozen synchronous stack |
| T7 | `trades_today` via UTC window vs market calendar | UTC window (default) | Possible boundary mismatch vs exchange session (see D2) |
| T8 | Recovery sub-order fixed by B9 vs configurable | Fixed deterministic order | Owner should confirm order (see D4) |

---

## 6. Every Risk

| # | Risk | Likelihood | Impact | Mitigation in design |
|---|------|-----------|--------|----------------------|
| R1 | Large position history slows startup replay (T2) | Low–Med | Med (slower restart) | O(N) bounded; v1 volumes small; could add snapshot table only as **V2** (no freeze break) |
| R2 | `trades_today` UTC boundary ≠ exchange session boundary | Med | Med (risk count off near midnight UTC) | Owner Decision D2; documented assumption A4 |
| R3 | Recovery finds inconsistent rows (orphan fill, etc.) | Low | Med | Non-destructive: alert + DLQ + continue with consistent subset (A8/D5) |
| R4 | `Sent` orders unreconciled after crash (no broker in v1) | Med | Med | Duplicate protection re-registered (§8); reconciliation deferred to D7/owner; documented |
| R5 | Mock broker masks real broker integration gaps | High (by design) | Low for v1 (no live trading) | Explicitly v1 scope; real adapters owner-gated D7 |
| R6 | Redis warming races with first reads | Low | Low | Reads fall back to PG; Redis non-authoritative |
| R7 | Scheduler started before recovery completes | Low | Med | Design mandates scheduler start **after** recovery (§11 step 5) |
| R8 | Kill-switch level integer↔D4 enum mapping at RiskState boundary | Low | Med (wrong gating if mismapped) | Single mapping point; covered by B9 tests; no D4 change |
| R9 | Multi-process deployment assumed single-process (A9) | Low (v1) | High if violated | Documented as out of scope; HA is V2 |

---

## 7. Every Dependency

**B9 depends on (consumes, unmodified):**
- **D1** — models/enums for reading rows and building inputs.
- **D2** — `DataAccessLayer` interface (`list`/`count`/structural lookups), error hierarchy.
- **D3** — `SelectionEngine` (constructed, wired).
- **D4** — `RiskDecisionEngine`, `RiskState`/`KillSwitchLevel` semantics (inputs supplied; rules untouched).
- **D5** — `ExecutionEngine`, `DuplicateOrderProtection`, `BrokerSyncContract` ABC.
- **D6** — `PortfolioState` (`open_position`/`close_position`/`snapshot`/`sector_exposure`).
- **B7** — `ConnectionPool`, `PostgresDataAccessLayer`, `RedisClient`, `PersistenceError`.
- **B8** — `AlertManager`, `DeadLetterQueue`, `KillSwitchLevelCache`, `HealthMonitor`, `MetricsCollector`, `Scheduler`, workers, `HeartbeatEmitter`, `operational_state`.

**External runtime dependencies:** PostgreSQL (mandatory), Redis (optional), env config (`DATABASE_URL`, `REDIS_URL`, operational tunables, `starting_capital`).

**No new third-party libraries** beyond those B7/B8 already use (psycopg2, redis-py). **No circular dependencies** — B9 sits above all phases and is imported by none.

---

## 8. Components To Be Created in B9

| Component | Kind | Responsibility |
|-----------|------|----------------|
| `Application` | Wiring container | Holds the composed object graph; exposes start/shutdown |
| Bootstrap composition root | Function/class | Builds graph in dependency order (§3) |
| Recovery orchestrator | Function/class | Runs the four rebuilds read-only (§5) |
| PortfolioState rebuilder | Routine | Replays positions into D6 (§7) |
| DuplicateOrderProtection rebuilder | Routine | Re-registers in-flight order fingerprints (§8) |
| RiskState builder | Routine | Assembles D4 inputs on demand (§9) |
| Kill-switch rebuild invocation | Routine | Calls B8 `KillSwitchLevelCache.rebuild()` (§10) |
| Redis cache-warming step | Routine | Warms kill-switch + DLQ caches from PG (§6) |
| `pg_catalog` partition-exists reader | Read-only adapter | Backs B8 `MissingPartitionDetector` (detect-only) |
| `pg_catalog` partition-list reader | Read-only adapter | Backs B8 `RetentionTierer` (read-only) |
| Mock `BrokerSyncContract` | Test/E2E double | In-memory broker boundary (no network) |
| Scheduler startup/shutdown wiring | Routine | Register workers; start/stop (§11, §14) |

All are **integration/wiring constructs** — none is a domain entity, none is persisted, none introduces business rules.

---

## 9. Files Expected To Be Added in B9

> Indicative; final names set at implementation. **No existing file is modified.**

| Path | Purpose |
|------|---------|
| `thul-nurayn/src/app/__init__.py` | Package exports |
| `thul-nurayn/src/app/bootstrap.py` | Composition root + `Application` + startup/shutdown |
| `thul-nurayn/src/app/recovery.py` | Read-only rebuild flows (Portfolio, DuplicateOrder, RiskState builder, kill-switch invoke, Redis warm) |
| `thul-nurayn/src/app/catalog.py` *(or within recovery)* | Read-only `pg_catalog` readers for B8 detectors |
| `thul-nurayn/src/app/broker_mock.py` *(or in tests)* | In-memory `BrokerSyncContract` for E2E |
| `thul-nurayn/tests/test_app_integration.py` | Bootstrap wiring, rebuilds, health-gated startup, scheduler start/stop |
| `thul-nurayn/tests/test_e2e_pipeline.py` | In-memory E2E pipeline; PG-backed E2E behind `DATABASE_URL` |
| `B9_BUILD_REPORT.md` (repo root) | Build report at the B9 gate |

---

## 10. Explicit Confirmations

Based on the architecture as written (scope §2, assumptions §18, DoD §14/§17), the following are explicitly confirmed for B9:

| Confirmation | Status | Basis |
|--------------|--------|-------|
| No D1 changes | ✅ Confirmed | §2 forbids; B9 reads models/enums only |
| No D2 changes | ✅ Confirmed | §2 forbids; consumes DAL interface only |
| No D3 changes | ✅ Confirmed | §2; `SelectionEngine` constructed, not modified |
| No D4 changes | ✅ Confirmed | §9 supplies inputs only; "no rule change" |
| No D5 changes | ✅ Confirmed | §8 uses public methods; fingerprint logic untouched |
| No D6 changes | ✅ Confirmed | §7 uses public methods; analytics untouched |
| No D7 changes | ✅ Confirmed | D7 not built; broker boundary = mock only |
| No B8 changes | ✅ Confirmed | §11/§12 wire existing B8 objects unmodified |
| No schema changes | ✅ Confirmed | §2; recovery is read-only |
| No new tables | ✅ Confirmed | §2; no persistence added |
| No new enums | ✅ Confirmed | §2; level handled as integer data |
| No strategy changes | ✅ Confirmed | D3 unmodified |
| No risk-rule changes | ✅ Confirmed | D4 thresholds/gates/ordering unchanged |
| No execution-rule changes | ✅ Confirmed | D5 state machines unchanged |
| No sizing changes | ✅ Confirmed | V2-001 untouched; fixed 10%/trade |

> These confirmations are **design-level commitments** in the architecture. They will be **independently verified at the B9 audit** (path-filtered `git diff` over D1–D8 + grep checks), exactly as done for B7 and B8.

---

## 11. OWNER DECISIONS REQUIRED

The following must be approved (or amended) **before** implementation begins.

### D1 — Source of `starting_capital`
- **Description:** `PortfolioState` requires `starting_capital`. B9 proposes reading it from env/config (not a persisted entity).
- **Alternatives:** (a) env/config value; (b) derive from an existing persisted row; (c) a fixed constant in config.
- **Benefits:** (a) no schema change, operator-controlled, matches B6 assumption 9.
- **Risks:** a misconfigured value yields wrong cash/equity until corrected; no DB record of the figure used at a point in time.
- **Recommended:** **(a) env/config**, surfaced in logs at startup (redacted only if sensitive — it is not a secret). Simplest, freeze-safe.

### D2 — `trades_today` / trading-day boundary
- **Description:** D4's `trades_today` needs a day boundary. B9 defaults to a **UTC** calendar-day window over `orders.created_at`.
- **Alternatives:** (a) UTC midnight; (b) US market session boundary (e.g., America/New_York exchange day); (c) configurable timezone.
- **Benefits:** (a) trivial, deterministic; (b) matches real trading sessions (NASDAQ/NYSE); (c) flexible.
- **Risks:** (a) near midnight UTC the count can disagree with the exchange session, slightly affecting the Max-Trades/Day gate input; (b)/(c) more logic, but B9 must not change D4 rules — only the input window.
- **Recommended:** **(b) US market session day (America/New_York)** for correctness against NASDAQ/NYSE, implemented purely in the B9 input builder (no D4 change). If the owner prefers minimal v1 surface, fall back to (a) and record as a clarification.

### D3 — Broker boundary for E2E
- **Description:** The pipeline needs a `BrokerSyncContract` implementation to run E2E. B9 proposes a mock/in-memory double only.
- **Alternatives:** (a) mock/in-memory only; (b) wire a real paper/live D7 adapter; (c) skip broker-touching E2E entirely.
- **Benefits:** (a) full pipeline verified, no network, honors "no broker connectivity"; (c) smallest surface.
- **Risks:** (a) does not exercise a real broker (acceptable for v1; real integration is D7); (b) violates current freeze + "no broker connectivity"; (c) leaves the execution leg unverified end-to-end.
- **Recommended:** **(a) mock/in-memory only.** Real adapters remain owner-gated D7.

### D4 — Recovery sub-order
- **Description:** The intra-recovery order (which aggregate rebuilds first). Reviewer proposes: kill-switch cache → PortfolioState → DuplicateOrderProtection → RiskState builder ready → warm Redis.
- **Alternatives:** (a) kill-switch first (so it's available to RiskState/health); (b) PortfolioState first; (c) order-independent (all read-only, no cross-write dependency).
- **Benefits:** (a) clear, makes kill-switch level available early; (c) technically valid since all are read-only and independent.
- **Risks:** minimal — no aggregate writes during recovery, so order cannot corrupt data; only affects which is "ready" first.
- **Recommended:** **(a) kill-switch → Portfolio → DuplicateOrder → RiskState → warm Redis**, for clarity and early operational-state correctness. Confirm so the build report matches an approved order.

### D5 — Handling of recovery-time data inconsistencies
- **Description:** If recovery encounters an inconsistent row (e.g., a fill referencing a missing position), how should B9 behave?
- **Alternatives:** (a) alert + DLQ + continue with the consistent subset (non-destructive); (b) abort startup on any inconsistency (fail-closed); (c) attempt automatic repair.
- **Benefits:** (a) system still starts; operator triages via DLQ; (b) maximal safety — never runs on suspect state; (c) self-healing.
- **Risks:** (a) starts in a partially-recovered state (surfaced, not hidden); (b) a single bad row blocks all trading; (c) violates "non-destructive / PostgreSQL truth" and risks masking corruption — **not recommended**.
- **Recommended:** **(a) alert + DLQ + continue**, as in the architecture (A8) — with an owner-set option to choose **(b) fail-closed** if the owner prefers maximal caution for a trading system. This is the most consequential decision; please rule explicitly.

### D6 — Scheduler autostart vs manual start
- **Description:** Whether `bootstrap()` automatically starts the B8 scheduler loop, or returns an `Application` the operator starts explicitly.
- **Alternatives:** (a) autostart after recovery; (b) construct only, operator calls `application.start()`.
- **Benefits:** (a) one-call bring-up; (b) operator controls when background jobs begin (useful for maintenance/recovery inspection).
- **Risks:** (a) jobs run immediately, possibly before an operator verifies recovery; (b) requires an explicit start step.
- **Recommended:** **(b) explicit `start()`** — bootstrap composes + recovers; the operator (or a thin entrypoint) starts the scheduler. Safer for a trading system; aligns with health-gated philosophy.

---

## 12. Reviewer Assessment

- The B9 architecture is **internally consistent** with the frozen invariants and the approved B7/B8 designs. It correctly confines itself to wiring + read-only recovery and reuses existing public interfaces (verified against the real signatures: `PortfolioState.open_position/close_position`, `DuplicateOrderProtection.register`, D4 `RiskState` fields, `KillSwitchLevelCache.rebuild`).
- **No freeze violations** are present in the design; the five "No" answers hold and are independently auditable at the B9 gate.
- **One high-consequence decision (D5)** and one **correctness decision (D2)** warrant explicit owner rulings before implementation; the remaining decisions (D1, D3, D4, D6) have clear recommended defaults.

---

## 13. Stop Gate

**STOP.**

This is an **architecture review only** — no code, no tests, no implementation. Awaiting owner rulings on **D1–D6 (§11)** and approval of the B9 architecture before any implementation begins.
