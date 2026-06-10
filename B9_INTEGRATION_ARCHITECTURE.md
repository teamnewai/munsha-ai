# B9_INTEGRATION_ARCHITECTURE

**Type:** Pre-implementation architecture review. **No code. No tests. No source changes. No schema changes.**
**Derived from:** `THUL-NURAYN_v1_MASTER_SPECIFICATION.md` · `PROJECT_STATE_CHECKPOINT_B7.md` · `B8_OPERATIONS_ARCHITECTURE.md` · `B8_BUILD_REPORT.md` · `B8_AUDIT.md` · approved B1–B8 artifacts.
**Resume point:** B8 complete & audited PASS (`200e9bf`) · 254 passed / 23 skipped.
**Status:** Architecture only — implementation forbidden until owner approval.

**Invariants preserved throughout:** PostgreSQL is the **sole source of truth** · Redis is **non-authoritative** (ephemeral cache) · **Portfolio ⟂ Risk ⟂ Execution** separation intact · no broker connectivity · no API/UI · no strategy changes · no risk-rule changes · no sizing logic · no schema changes · no new tables · no new enums · **no modifications to D1–D8**.

---

## 1. Purpose

B9 is the **integration & recovery** layer. It composes the already-built, independently-tested phases (D1–D6 domain, B7 persistence, B8 operations) into a single runnable application, and it defines how the system **recovers its transient in-memory state from PostgreSQL on startup/restart**.

B9 adds **no domain logic**: it does not score, decide risk, execute, size, or compute portfolio analytics. It is *wiring + rebuild glue*. Every behavior it triggers already exists in an approved phase; B9 only constructs the objects, injects dependencies, orders startup/shutdown, and replays persisted facts into the transient aggregates that those phases own.

B9 realizes the rebuild responsibilities that earlier phases explicitly deferred to it (PROJECT_STATE_CHECKPOINT_B7 §5 "Recovery model"; B8_BUILD_REPORT §5 DR sequence step noting domain-aggregate rebuild is B9 scope).

---

## 2. Scope

**B9 IS in scope:**

- A new integration package (planned `src/app/`) containing **bootstrap/composition** and **recovery/rebuild** modules — wiring only, no domain logic.
- **Startup sequence**: ordered bring-up of infrastructure → operations → recovery → domain wiring → scheduler.
- **Dependency wiring**: construct `ConnectionPool` → `PostgresDataAccessLayer` → `RedisClient` → B8 operations objects → D3/D4/D5/D6 engines, injecting the single DAL everywhere.
- **Recovery flows**: rebuild `PortfolioState` (D6), `DuplicateOrderProtection` (D5), risk counters/`RiskState` inputs (D4), and prime the kill-switch cache (B8) — all read-only from PostgreSQL.
- **Scheduler startup/shutdown**: register and start the B8 workers; graceful stop.
- **Health-gated startup**: refuse to start the trading pipeline if PostgreSQL is unreachable; continue DEGRADED if only Redis is down.
- **End-to-end wiring** of the existing Signal→Score→Risk→Execution→Fill→Portfolio pipeline using the durable DAL, with the D5 broker boundary wired only to a **mock/in-memory `BrokerSyncContract`** implementation for E2E verification (no network, no real broker).
- **Graceful shutdown** and **restart semantics**.
- B9 integration/E2E tests (in-memory DAL as the default test backend; PostgreSQL-backed E2E behind `DATABASE_URL`, skipped otherwise).

**B9 is NOT in scope (explicitly forbidden):**

- Any modification to D1 (`src/enums`, `src/models`, `db/`), D2 (`src/data_access`), D3 (`src/selection`), D4 (`src/risk`), D5 (`src/execution`), D6 (`src/portfolio`), B7 (`src/persistence`, `src/redis`), or B8 (`src/operations`, `src/config`, `src/logging`).
- Any new SQL table, column, constraint, index, or enum; any schema change.
- Strategy/scoring changes (D3), risk-rule changes (D4), order/position state-machine changes (D5), portfolio-analytics changes (D6), position sizing (V2-001).
- Broker connectivity / IBKR / TradingView / market data (D7, owner-gated).
- API / FastAPI / WebSocket / UI / dashboards (owner-gated).
- Async/await; ORM frameworks; new repository ABCs.
- Automatic retry of failed work (DLQ resolution remains manual, per B8).

---

## 3. Application Bootstrap

**Module (planned):** `src/app/bootstrap.py`.

A single composition root assembles the object graph in dependency order and returns an `Application` handle (a plain wiring container — not a domain object, not persisted). The bootstrap is the **only** place that knows concrete backends; every consumer receives interfaces (the D2 `DataAccessLayer`, the B8 objects).

Composition order (each step depends only on prior steps):

1. **Config & logging** — `OperationsConfig.from_env()`; `configure_logging()` (B8; secrets redacted). No DSNs in code.
2. **Infrastructure** — `ConnectionPool` (B7; env DSN; startup health check — raises `PersistenceError` if PostgreSQL unreachable); `RedisClient` (B7; non-fatal/degraded).
3. **DAL** — `PostgresDataAccessLayer(pool)` (B7). This single DAL instance is injected everywhere.
4. **Operations (B8)** — `AlertManager`, `DeadLetterQueue`, `KillSwitchLevelCache`, `HealthMonitor`, `MetricsCollector`, `Scheduler` (+ workers). All receive the DAL/Redis.
5. **Recovery (B9)** — run the rebuild flows (§5–§10) to reconstruct transient aggregates from PostgreSQL.
6. **Domain engines (D3–D6)** — construct `SelectionEngine`, `RiskDecisionEngine`, `ExecutionEngine`, and the rebuilt `PortfolioState`, injecting the DAL where each already expects it. No engine internals change.
7. **Scheduler start** — register B8 workers and start the background loop.

Bootstrap is **idempotent per process** and performs **no destructive action**. It never writes domain rows during composition except the operational lifecycle event `ServiceStarted` (B8 `HeartbeatEmitter`).

---

## 4. Dependency Wiring

**Single-DAL principle.** Exactly one `PostgresDataAccessLayer` is created and shared. D5 `AuditEventFlow`, D6 `persist_stats(stats, dal)`, B8 event/DLQ/kill-switch writers, and all structural lookups route through it — so all writes become durable and all reads are consistent.

| Consumer | Injected dependency | Notes |
|----------|--------------------|-------|
| B8 `AlertManager` / `DeadLetterQueue` / `KillSwitchLevelCache` | DAL, RedisClient | durable `system_events`; Redis cache non-authoritative |
| B8 `HealthMonitor` / `MetricsCollector` | ConnectionPool, RedisClient, DAL | read-only probes/metrics |
| B8 `Scheduler` + workers | DAL, AlertManager, DLQ | failure isolation already built |
| `MissingPartitionDetector` (B8) | injected `partition_exists(table, yyyymm)` | B9 backs it with a pool-driven `pg_catalog` read (read-only; detect-only, A2) |
| `RetentionTierer` (B8) | injected `list_partitions()` | B9 backs it with a pool-driven `pg_catalog` read (read-only) |
| D3 `SelectionEngine` | DAL | existing constructor; no change |
| D4 `RiskDecisionEngine` | `RiskState` inputs (built by B9 from DAL) | B9 supplies inputs D4 already expects; rules unchanged |
| D5 `ExecutionEngine` | DAL, `DuplicateOrderProtection` (rebuilt), `BrokerSyncContract` (mock) | broker boundary = ABC; mock only |
| D6 `PortfolioState` | `starting_capital` config; rebuilt registries | `persist_stats` takes DAL at call time |

**The two `pg_catalog` readers** B9 provides for the B8 detectors are **read-only** (`SELECT` against `pg_catalog`/`information_schema`); they create nothing and modify nothing — honoring A2.

---

## 5. PostgreSQL Recovery Flow

**Module (planned):** `src/app/recovery.py`. All recovery is **read-only** against PostgreSQL; PostgreSQL is the sole source of truth.

General recovery contract:

1. Confirm PostgreSQL reachable (already guaranteed by step 2 of bootstrap; otherwise the process aborts).
2. Read the durable facts via the DAL (`list`/`count`/structural lookups) — no writes.
3. Replay those facts into freshly-constructed transient aggregates using **only the existing public methods** of D5/D6 (so all invariants/state-machine rules are honored by the owning phase).
4. Surface any inconsistency as a B8 alert + DLQ entry (operational), never by mutating domain rows.

The recovery flows for the four transient aggregates are detailed in §6–§10.

---

## 6. Redis Cold-Start Recovery

Redis is **non-authoritative** and treated as **cold** on every restart (PROJECT_STATE_CHECKPOINT_B7 §5).

- B9 assumes Redis holds nothing durable. It does **not** read application state from Redis at startup.
- After the PostgreSQL rebuilds (§7–§10) complete, B9 **warms** the Redis caches *from PostgreSQL*:
  - kill-switch level cache ← `KillSwitchLevelCache.rebuild()` (§10),
  - DLQ unresolved index ← `DeadLetterQueue.rebuild_index()` (B8).
- If Redis is unavailable, warming is skipped with a `Warning`; the system runs DEGRADED and every read falls back to PostgreSQL. No startup failure.
- B9 never treats a populated Redis as a shortcut that bypasses PostgreSQL truth.

---

## 7. PortfolioState Rebuild

**Owner:** D6 `PortfolioState` (unchanged). **B9 role:** replay persisted positions into a fresh instance.

Inputs (read-only from PostgreSQL via DAL):
- `starting_capital` — configuration value (env/config; not a persisted entity), consistent with D6's constructor contract and B6 assumption 9.
- All `positions` with `status = Closed` (for cumulative realized PnL / cash).
- All `positions` with `status = Open` (for the open registry & exposure).

Rebuild procedure (uses only existing D6 public methods):
1. `state = PortfolioState(starting_capital)`.
2. For each **closed** position (ordered by `closed_at`, then `opened_at`): `state.open_position(p)` then `state.close_position(p)` — this replays realized PnL into `cash` exactly as live trading did (D6 `close_position` requires the position to have been opened first; B9 honors that).
3. For each **open** position: `state.open_position(p)`.
4. Result: `account.cash` = `starting_capital + Σ realized PnL`; open registry reflects all OPEN positions. Marks are **passed in at snapshot time** (D6 never fetches prices) — B9 does not fetch or inject marks during rebuild.

No PnL/equity/drawdown is *computed* by B9; D6 computes it on the next `snapshot(marks)` call. Determinism: replay order is fixed and total.

---

## 8. DuplicateOrderProtection Rebuild

**Owner:** D5 `DuplicateOrderProtection` (unchanged). **B9 role:** re-register active fingerprints.

Inputs (read-only): all `orders` with `status ∈ {New, Sent}` (in-flight orders whose fingerprints must remain blocked to prevent duplicate submission after restart).

Rebuild procedure (uses only existing D5 public methods):
1. `dop = DuplicateOrderProtection()`.
2. For each in-flight order: `dop.register(order)` (D5 computes the fingerprint; B9 does not reimplement it).
3. Orders in terminal states (`Filled`/`Rejected`/`Cancelled`) are **not** registered — their fingerprints are free again, matching live `release` semantics.

This guarantees that a replayed/repeated signal after restart is still rejected as a duplicate, exactly as before the restart.

---

## 9. RiskState Rebuild

**Owner:** D4 `RiskDecisionEngine` (rules unchanged). **B9 role:** assemble the **inputs** D4 already expects — it does **not** decide risk.

D4 consumes a `RiskState` of *passed-in* figures (D4 explicitly does not compute equity/PnL/positions). B9 provides a **RiskState builder** that, at decision time, reads current counters from PostgreSQL + the rebuilt aggregates:

| `RiskState` field | Source (read-only) |
|-------------------|--------------------|
| `kill_switch_level` | B8 `KillSwitchLevelCache.current_level()` (§10) |
| `open_positions` | `dal.positions.count(status=Open)` (or rebuilt `PortfolioState.open_count`) |
| `trades_today` | `orders` created in the current trading day |
| `daily_drawdown` / `weekly_drawdown` | figures from D6 `PortfolioState.snapshot(marks)` (D6 computes; D4 consumes) |
| `monthly_pause_active` | derived from the same D6 figures / recorded flag |
| `consecutive_losses` | closed `positions` realized-PnL sequence (read-only) |
| `candidate_sector_current_exposure` / `_added_exposure` | per-candidate at decision time via D6 `sector_exposure(...)` |

B9 only *supplies* these inputs to the existing D4 engine; it changes no threshold, no gate, no ordering, no decision. **Portfolio ⟂ Risk ⟂ Execution** is preserved: D6 computes figures, D4 decides, D5 executes.

---

## 10. Kill-Switch Cache Rebuild

**Owner:** B8 `KillSwitchLevelCache` (unchanged). **B9 role:** invoke rebuild during startup.

1. `level = kill_switch_cache.rebuild()` — reads the latest `KillSwitchActivated` row from `system_events` (PostgreSQL = truth) and returns the level (0 if none).
2. The rebuilt level repopulates the Redis cache (non-authoritative).
3. The level is treated as **data** (an integer) by B8/B9 — no D4 `KillSwitchLevel` import (preserving B8's no-D4-dependency property). When D4 needs it, the integer is mapped to the level D4 already understands at the RiskState boundary (§9), without B9 changing D4.
4. B9 **never sets or changes** the kill-switch level; it only recovers and serves what D4/owner previously recorded.

---

## 11. Scheduler Startup

1. Construct the B8 `Scheduler(dal, alert_manager, dlq)`.
2. Register workers: `HealthPoller`, `DLQMonitor`, `MissingPartitionDetector` (detect-only, A2 — backed by B9's read-only `pg_catalog` checker), `RetentionTierer` (read-only — backed by B9's read-only lister).
3. Emit `ServiceStarted` (B8 `HeartbeatEmitter.on_start()`).
4. `scheduler.start(tick_sec=…)` — the existing synchronous daemon loop; per-worker failure isolation is already built (a failing `run_once()` is recorded as `WorkerFailure` + dead-lettered; the scheduler survives).
5. Scheduler start happens **after** recovery (§5–§10) so workers observe a consistent rebuilt state.

No new scheduling primitives are introduced; B9 only registers existing workers and starts the existing loop.

---

## 12. Health State Transitions

B9 wires the existing B8 `HealthMonitor` and reflects its output; it adds no new health logic.

- **At startup:** PostgreSQL reachable is mandatory (bootstrap step 2). If reachable + Redis up → operational state `RUNNING`; if Redis down → `DEGRADED`.
- **At runtime:** the `HealthPoller` worker drives `HealthMonitor.check()` on its cadence; the monitor emits a single `system_events` row on each component **transition** (up↔down) — never per poll (B8 behavior).
- **Operational state** (`operational_state(health, kill_switch_level)`, B8) is computed observationally: not-ready or L4 → `SHUTDOWN`; L2/L3 → `PAUSED`; degraded health → `DEGRADED`; else `RUNNING`. B9 surfaces this state; it does **not** pause/halt trading itself — pausing is owned by D4 (kill-switch) and D5 (execution).

---

## 13. Failure Recovery Rules

| Condition (at startup or runtime) | B9 response | Authority |
|-----------------------------------|-------------|-----------|
| PostgreSQL unreachable at startup | Abort bootstrap; `PersistenceError`; process does not start | B7 health check |
| Redis unreachable at startup | `Warning`; continue DEGRADED; skip cache warming; reads fall back to PostgreSQL | B8/B9 |
| PostgreSQL lost mid-operation | Exception propagates to caller → upstream Fail-Safe; affected unit recorded/dead-lettered | B7/B8 |
| Rebuild reads an inconsistency (e.g., a fill referencing a missing position) | Record a `WorkerFailure` + DLQ entry (operational); continue startup with the consistent subset; **never** mutate or "repair" domain rows | B8 DLQ |
| A worker fails post-startup | Recorded + dead-lettered; scheduler continues | B8 scheduler |
| Kill-switch L4 recorded | Operational state `SHUTDOWN`; B9 surfaces it; pausing/halting trades remains D4/D5 | D4/B8 |
| No automatic retry anywhere | Manual DLQ resolution only | B8 policy |

B9 recovery is **non-destructive and read-only** with respect to domain data. Any anomaly is surfaced operationally (alert + DLQ), not silently corrected.

---

## 14. Graceful Shutdown

**Module (planned):** `src/app/bootstrap.py` (shutdown path).

Ordered, reverse of startup:
1. Stop the scheduler (`scheduler.stop()`) — finishes the current tick, runs no new jobs.
2. Allow any in-flight DAL operation/transaction to complete or roll back atomically (B7 transaction guarantees).
3. Emit `ServiceStopped` (B8 `HeartbeatEmitter.on_stop()`).
4. Close infrastructure: `ConnectionPool.close()`; Redis client released. (Redis is ephemeral; nothing to flush durably.)

Shutdown writes no domain rows beyond the operational `ServiceStopped` event. It is safe to call once; idempotent thereafter. No data loss: all durable state already lives in PostgreSQL.

---

## 15. Restart Semantics

- **Crash-equivalent.** Because PostgreSQL is the sole source of truth and Redis is cold, an unclean crash and a graceful stop+start converge to the same recovered state. Restart = bootstrap (§3) including recovery (§5–§10).
- **Idempotent recovery.** Replaying positions/orders into fresh aggregates is deterministic and total; running recovery twice yields the same in-memory state. Recovery performs no writes, so repeated restarts cannot drift the database.
- **In-flight orders.** Orders left `New`/`Sent` at crash are re-registered in `DuplicateOrderProtection` (§8), so duplicates remain blocked. Reconciliation of `Sent` orders against a broker is **D7/owner-gated** and out of B9 scope; v1 E2E uses the mock contract.
- **At-least-once operational events.** A `ServiceStarted` may be appended on each restart (append-only `system_events`); this is expected and harmless (latest-row-wins semantics for kill-switch; DLQ keyed by id).
- **No partition auto-provisioning on restart** (A2): if the upcoming partition is missing, `MissingPartitionDetector` alerts; an external ops process provisions it.

---

## 16. End-to-End Component Diagram

```
                         ┌─────────────────────────────────────────────┐
                         │              B9 Bootstrap (src/app)          │
                         │   composition root · startup/shutdown order  │
                         └───────────────┬─────────────────────────────┘
                                         │ constructs & injects (single DAL)
        ┌────────────────────────────────┼───────────────────────────────────┐
        ▼                                ▼                                     ▼
┌───────────────┐              ┌──────────────────┐                 ┌────────────────────┐
│ B7 Infra      │              │ B8 Operations    │                 │ B9 Recovery        │
│ ConnectionPool│──pool──────► │ HealthMonitor    │                 │ (read-only replay) │
│ RedisClient   │              │ AlertManager     │                 │  • PortfolioState  │
│ PostgresDAL ──┼───DAL──────► │ DeadLetterQueue  │ ◄──records──────│  • DuplicateOrder… │
└──────┬────────┘              │ KillSwitchCache  │                 │  • RiskState inputs│
       │ source of truth       │ Scheduler+Workers│                 │  • KillSwitch prime│
       │                       │ MetricsCollector │                 └─────────┬──────────┘
       ▼                       └────────┬─────────┘                           │ rebuilt aggregates
┌───────────────┐                       │ durable system_events               ▼
│ PostgreSQL    │ ◄─────────────────────┘                          ┌────────────────────┐
│ (19 tables)   │                                                  │ Domain pipeline     │
│  truth        │ ◄────────── all writes via single DAL ───────────│ D3 Selection        │
└───────────────┘                                                  │  → D4 Risk (decide) │
        ▲                                                          │  → D5 Execution     │
        │ cold on restart                                          │     (+DuplicateProt,│
┌───────────────┐                                                  │      BrokerContract │
│ Redis (cache) │ ◄── warmed FROM PostgreSQL after recovery ───────│      = mock only)   │
│ non-authorit. │                                                  │  → Fill → D6 Port.  │
└───────────────┘                                                  └────────────────────┘

Separation preserved:  D6 computes figures  ⟂  D4 decides  ⟂  D5 executes.
Broker boundary:       D5 BrokerSyncContract (ABC) → mock/in-memory only (no network, no D7).
```

---

## 17. Definition of Done

1. `src/app/` integration package: bootstrap (composition root) + recovery (rebuild flows) — wiring only, no domain logic.
2. **Bootstrap** constructs the object graph in dependency order (§3) and returns an `Application` handle; single shared `PostgresDataAccessLayer`.
3. **Startup is health-gated**: PostgreSQL unreachable ⇒ abort (`PersistenceError`); Redis down ⇒ DEGRADED, continue.
4. **PortfolioState rebuild** replays closed→open positions via D6 public methods; cash = starting_capital + Σ realized PnL.
5. **DuplicateOrderProtection rebuild** re-registers `New`/`Sent` order fingerprints via D5 public methods.
6. **RiskState builder** assembles D4's expected inputs read-only from PostgreSQL + rebuilt aggregates; no rule change.
7. **Kill-switch cache rebuild** invoked at startup; level recovered from latest `KillSwitchActivated`; never set by B9.
8. **Redis cold-start**: caches warmed from PostgreSQL after recovery; skipped gracefully if Redis down.
9. **Scheduler** registers existing B8 workers (incl. detect-only partition + read-only retention backed by B9 `pg_catalog` readers) and starts after recovery.
10. **Health transitions** surfaced via B8; operational state observational only.
11. **Graceful shutdown** stops scheduler, emits `ServiceStopped`, closes pool; idempotent; no data loss.
12. **Restart semantics**: recovery is read-only, deterministic, idempotent; crash ≡ graceful restart.
13. **E2E pipeline** wired Signal→Score→Risk→Execution→Fill→Portfolio over the durable DAL, broker boundary = mock `BrokerSyncContract` only.
14. **No new entities/tables/enums/schema**; **D1–D8 unmodified** (path-filtered diff empty).
15. **All existing 254 tests remain green**; B9 integration tests cover bootstrap wiring, each rebuild flow, health-gated startup, scheduler start/stop, and an in-memory E2E pipeline pass; PostgreSQL-backed E2E behind `DATABASE_URL`.
16. **No secrets** in code or version control.
17. **Invariants preserved**: PostgreSQL sole source of truth · Redis non-authoritative · Portfolio ⟂ Risk ⟂ Execution · no broker connectivity · no API/UI · no strategy/risk-rule/sizing changes.
18. `B9_BUILD_REPORT.md` produced; stop at the B9 gate.

---

## 18. Assumptions

1. **B9 adds a new integration package** (`src/app/`), analogous to how B8 added `src/operations/`. It contains only composition and read-only rebuild glue; it imports and orchestrates D1–D8 but modifies none of them.
2. **`starting_capital` is configuration**, supplied via env/config (B6 assumption 9), not a persisted entity. B9 reads it from config to construct `PortfolioState`.
3. **Marks are not part of rebuild.** D6 never fetches prices; `snapshot(marks)` receives marks at call time. B9 rebuilds registries/cash only; equity/drawdown are computed later by D6 when marks are supplied (out of B9's rebuild path).
4. **`trades_today` / trading-day boundary** is computed from `orders.created_at` against a UTC trading-day window; B9 supplies the figure as a D4 input without changing D4 rules. (If a precise market-calendar boundary is later required, that is a clarification, not a B9 rule change.)
5. **`consecutive_losses`** is derived read-only from the closed-position realized-PnL sequence (win = PnL > 0, loss = PnL ≤ 0, per B6 assumption 11) and supplied as a D4 input. No new persistence.
6. **Broker boundary uses a mock only.** v1 E2E wires an in-memory `BrokerSyncContract` implementation (no network, no D7). Real broker adapters and `Sent`-order reconciliation remain owner-gated.
7. **`pg_catalog` readers are read-only.** B9 backs the B8 partition detector/retention lister with `SELECT`-only queries against `pg_catalog`/`information_schema`; they create/alter/drop nothing (honoring A2).
8. **Recovery is non-destructive.** Inconsistencies discovered during replay are surfaced as B8 alerts + DLQ entries; B9 never repairs, deletes, or mutates domain rows to "fix" them.
9. **Single process, synchronous.** B9 composes the synchronous stack (psycopg2/redis-py/synchronous engines). No async/await; the scheduler uses the existing B8 daemon-thread loop. Multi-process/HA orchestration is out of v1 scope.
10. **Append-only operational events on restart are expected.** Repeated `ServiceStarted` rows are harmless; kill-switch uses latest-row-wins; DLQ items are keyed by id.
11. **No automatic retry.** Consistent with B5/B7/B8; DLQ resolution is manual.
12. **E2E test backend.** In-memory `DataAccessLayer` is the default test double (drop-in for `PostgresDataAccessLayer` behind the D2 ABC); PostgreSQL-backed E2E runs only when `DATABASE_URL` is set, otherwise skipped (consistent with B7/B8 test strategy).

---

## 19. Stop Gate

**STOP.**

This document is **architecture only** — no code, no tests, no source changes, no schema changes, no modifications to D1–D8. Implementation is forbidden until owner approval.

Await owner review and approval before any B9 implementation begins. Do not proceed past this gate.
