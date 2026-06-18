# B8_OPERATIONS_ARCHITECTURE

**Type:** Pre-implementation architecture review. **No code. No tests. No source changes. No schema changes. No modifications to B1–B7.**
**Derived from:** `THUL-NURAYN_v1_MASTER_SPECIFICATION.md` · `PROJECT_STATE_CHECKPOINT_B7.md` · approved B1–B7 artifacts.
**Resume point:** `PROJECT_STATE_CHECKPOINT_B7.md` @ `5d67b5e` · 210 passed / 23 skipped.
**Status:** Architecture only — implementation forbidden until owner approval.

**Invariants preserved throughout this document:** PostgreSQL is the sole source of truth · Redis is a non-critical, ephemeral cache · **Portfolio ⟂ Risk ⟂ Execution** (B8 observes and records; it never decides risk, never executes, never computes portfolio analytics) · no broker integration · no API/UI · no strategy logic · no sizing logic.

---

## 1. Purpose

B8 provides the **operations and monitoring** layer for THUL-NURAYN v1. It makes the system observable, alertable, and operationally recoverable without adding any domain logic.

B8:

- Detects and reports the health of the persistence infrastructure delivered in B7 (PostgreSQL via `ConnectionPool`, Redis via `RedisClient`).
- Emits durable system events (service start/stop, worker failure, kill-switch activation, infrastructure events) into the existing append-only `system_events` table.
- Provides a **Dead Letter Queue (DLQ)** for work that fails irrecoverably — durable, manually resolved, never auto-retried.
- Runs background operational jobs (health polling, DLQ monitoring, monthly partition provisioning, retention tiering) through a synchronous scheduler/worker model that uses the B7 `PostgresDataAccessLayer` and `RedisClient` behind the existing D2 abstraction.
- Maps failures to severities, drives an alert-dispatch contract, and exposes operational metrics.
- Caches the current kill-switch **level** in Redis for fast reads while keeping `system_events` as its durable source of truth — without making or changing any risk decision.

B8 adds **no domain logic**. It is operational plumbing layered above B7, orthogonal to D3/D4/D5/D6.

---

## 2. Scope

**B8 IS in scope:**

- Health monitoring of PostgreSQL and Redis (reuse B7 `ConnectionPool` health check and `RedisClient.ping()`/degraded-mode reporting).
- Durable system-event emission via `dal.system_events.add(...)` (append-only; existing table; existing `SystemEventType` members).
- DLQ: durable capture of dead-lettered work items, operator listing, and manual resolution — persisted in existing tables (see §5); no automatic retry.
- A synchronous scheduler/worker model for recurring operational jobs.
- Alerting: a severity-driven `AlertDispatcher` contract (internal B8 abstraction) with graceful degradation; durable record always written to `system_events`.
- Metrics & observability: structured logging (fills the `src/logging/` placeholder) and read-only operational metrics computed from PostgreSQL/Redis.
- Configuration: env-based operational settings (fills the `src/config/` placeholder); no secrets in code or version control.
- Kill-switch **level** caching (write-through to `system_events`, Redis cache, rebuild-on-restart read path) — recording and serving only, never deciding.
- Operational state model (RUNNING / DEGRADED / PAUSED / SHUTDOWN) derived from health + kill-switch level.
- Backup / DR / runbook documentation.
- B8 integration tests (require a running PostgreSQL/Redis test instance; existing 194 + B7's 16 always-run tests must stay green).

**B8 is NOT in scope (explicitly forbidden):**

- Any new SQL table, column, constraint, index, or enum; any modification to the frozen D1 schema.
- Any modification to D1 (`src/enums/`, `src/models/`), D2 (`src/data_access/`), D3 (`src/selection/`), D4 (`src/risk/`), D5 (`src/execution/`), D6 (`src/portfolio/`), or B7 (`src/persistence/`, `src/redis/`).
- Making or changing **risk decisions** or kill-switch **levels** (D4 owns the decision; the owner/operator triggers level changes).
- Order/position state machines, order routing, or execution (D5).
- Portfolio analytics, PnL, or snapshots (D6).
- Selection/scoring logic (D3).
- Broker connectivity, market data, gateways (D7, owner-gated).
- API / FastAPI / WebSocket / UI / dashboards (D9, owner-gated).
- Position sizing (V2-001).
- Automatic retry of failed work (manual DLQ resolution only).
- Async/await; ORM frameworks.

---

## 3. Health Monitoring Architecture

**Module (planned):** `src/operations/health.py` (new B8 package — infrastructure only, no domain logic).

**Probes**

| Probe | Mechanism | Source |
|-------|-----------|--------|
| PostgreSQL liveness | Acquire a pooled connection, run `SELECT 1`, release | Reuse B7 `ConnectionPool` health-check path |
| Redis liveness | `RedisClient.ping()` | B7 `RedisClient` (non-fatal) |
| Scheduler heartbeat | Last-run timestamp per job, cached in Redis; fallback to in-memory | B8 scheduler |
| DLQ depth | `COUNT` of unresolved dead-letter records | `system_events` query (see §5) |

**Readiness semantics**

- **PostgreSQL is mandatory.** If PostgreSQL is unreachable, the system is **not ready** (consistent with B7: the application cannot start with a broken DB; `PersistenceError` on startup).
- **Redis is optional.** If Redis is unreachable, health reports **DEGRADED**, not DOWN — Redis is a non-critical cache; PostgreSQL remains the source of truth.
- Health checks are **read-only and side-effect-free** except for emitting `system_events` on a *state transition* (e.g., Redis available→unavailable emits one `RedisEvent`; not one per poll).

**Output:** a structured `HealthReport` value object (status, per-component results, timestamp) — a transient read model, not a persisted entity, not a new table.

---

## 4. Alerting Architecture

**Module (planned):** `src/operations/alerting.py`.

- **Severity vocabulary is the existing `SeverityLevel` enum** — `Warning` · `Critical` · `Emergency`. No new enum member.
- **Durable record first.** Every alert-worthy condition is recorded as an append-only `system_events` row (existing `SystemEventType` member + `severity` + `detail` JSONB) **before** any external dispatch. The durable record is authoritative; external delivery is best-effort.
- **`AlertDispatcher` contract (B8-internal ABC).** Defines `dispatch(event, severity)`. Concrete transports (e.g., log sink, webhook, email) are selected by env config at wiring time. No transport is a trading API, broker, or UI; transports are operational notification channels only.
- **Graceful degradation.** A dispatch transport failure logs a `WARNING` and never blocks the system or loses the durable `system_events` record. No automatic retry of dispatch.
- **Severity routing (policy, not enforcement):**

| Severity | Typical conditions | Routing intent |
|----------|--------------------|----------------|
| `Warning` | Redis unavailable; transient degraded mode; DLQ non-empty (below threshold) | Log + low-priority channel |
| `Critical` | Repeated worker failure; DLQ above threshold; partition-provisioning failure | Log + high-priority channel + `system_events` |
| `Emergency` | PostgreSQL unreachable mid-operation; kill-switch L4 recorded | Log + all channels + `system_events` |

B8 alerting **reports** conditions; it does not gate trading, change risk state, or decide kill-switch levels.

---

## 5. Dead Letter Queue (DLQ) Architecture

DLQ persistence was explicitly deferred to this phase (B5 Assumption 8; B7 Summary §6). Under the freeze, **no new DLQ table and no new enum member may be introduced.** B8 therefore realizes the DLQ on the existing append-only infrastructure:

**Durable store — `system_events` (existing, append-only, partitioned):**

- Each dead-lettered work item is appended as one `system_events` row.
- `event_type` = **`WorkerFailure`** (existing `SystemEventType` member — semantically: a unit of work failed and could not be processed).
- `severity` = `Critical` (or `Warning` below a configured depth threshold; `Emergency` for source-of-truth failures), drawn from the existing `SeverityLevel` enum.
- `detail` (JSONB) carries the full DLQ envelope: failed-item type, original payload, failure reason/exception class, correlation identifiers (e.g., `order_id`, `signal_id`, `broker_ref`, fingerprint), `failed_at`, and a `resolution` sub-object (`status`, `resolved_by`, `resolved_at`, `note`).
- **Append-only resolution:** because `system_events` forbids `update`/`delete` (`ImmutableViolation`), "resolution" is modeled as a **new appended** `WorkerFailure` row that references the original via a correlation id in `detail` (e.g., `{"dlq_ref": <original_id>, "resolution": "Resolved"}`). The current state of a DLQ item is the latest row for that correlation id — consistent with the kill-switch "latest row wins" pattern (B7 §6) and with append-only audit semantics.

**Fast operational index — Redis (non-critical cache):**

- An optional Redis set/list of unresolved DLQ correlation ids for fast operator listing and depth metrics.
- Non-authoritative: rebuilt from `system_events` on restart; if Redis is unavailable, the operator queries `system_events` directly (degraded but correct).

**Rules**

- **No automatic retry.** Dead-lettered items are resolved manually by an operator (Master Spec Fail-Safe; consistent with B5/B7 precedent).
- **No new persisted entity, table, or enum.** The DLQ is a usage pattern over the existing `system_events` table and the existing `WorkerFailure`/`SeverityLevel` vocabularies.
- DLQ producers (the workers/flows that dead-letter an item) call `dal.system_events.add(...)`; B8 provides the helper that builds the envelope. Domain layers (D3–D6) are unchanged.

> **Owner ratification requested (Assumption A1, §14):** modeling the DLQ as `WorkerFailure` `system_events` rows (rather than a dedicated `dead_letters` table) is the constraint-respecting choice under the v1 freeze. If a dedicated DLQ table is later desired, that is a schema change → V2 backlog.

---

## 6. Scheduler Architecture

**Module (planned):** `src/operations/scheduler.py`, `src/operations/workers.py`.

- **Synchronous model.** Consistent with the synchronous D2 `Repository` ABC and B7 drivers (psycopg2, redis-py). No async/await. No new repository ABC.
- **Worker contract (B8-internal ABC):** a `Worker` exposes `name`, `interval`, and `run_once()`. The scheduler invokes `run_once()` on a fixed cadence (thread/timer-based), wrapping each invocation in fail-safe handling.
- **Each worker uses only the B7 backend** behind the D2 abstraction: it receives a `PostgresDataAccessLayer` and a `RedisClient` by injection at wiring time (wiring itself is B9 scope). Workers never import D3/D4/D5/D6 logic.
- **Planned operational jobs (operations only, no domain decisions):**

| Worker | Cadence | Action | Notes |
|--------|---------|--------|-------|
| HealthPoller | seconds | Run §3 probes; emit `system_events` only on state transition | Read-only except transition events |
| DLQMonitor | seconds–minutes | Compute unresolved DLQ depth; alert per §4 thresholds | Reads `system_events`; updates Redis index |
| PartitionProvisioner | daily | Ensure the upcoming month's partitions exist for the 6 partitioned tables, per the **frozen D1 naming convention** (`<table>_pYYYYMM`, `partition_retention.sql`) | See ratification A2, §14 |
| RetentionTierer | daily | Apply Hot→Warm→Cold tiering markers/movement per D1 §7 (audit/system data archived, never deleted) | Operational; no table-definition change |
| HeartbeatEmitter | on start/stop | Emit `ServiceStarted` / `ServiceStopped` `system_events` | Existing enum members |

- **Failure handling per worker:** a `run_once()` exception is caught, logged, recorded as a `WorkerFailure` `system_events` row, optionally dead-lettered (§5), and the scheduler continues. One failing job never crashes the scheduler. **No automatic retry of the failed unit** beyond the next scheduled cadence.

> **Owner ratification requested (Assumption A2, §14):** monthly partition *provisioning* executes `CREATE TABLE <t>_pYYYYMM PARTITION OF <t> …` strictly following the already-approved convention recorded in `partition_retention.sql` (D1 §7 explicitly defers provisioning to "a later phase"). This adds **data partitions** to existing partitioned parents; it introduces **no new table definition, column, constraint, index, or enum**, and modifies no existing object or the frozen SQL files. If the owner prefers partition provisioning to be handled entirely by an external DBA/ops process outside the application, B8 will instead only **detect and alert** on a missing upcoming partition.

---

## 7. Metrics & Observability

**Module (planned):** `src/operations/metrics.py`; structured logging fills `src/logging/`.

- **Structured logging:** a single structured logger configuration (JSON or key=value), severity-tagged, correlation-id aware. No secrets ever logged (DSNs, tokens redacted). Fills the B1 `src/logging/` placeholder, mirroring how B7 filled `src/redis/`.
- **Operational metrics (read-only, computed on demand):** DB reachability/latency, Redis availability, scheduler per-job last-run/last-success, DLQ depth, append-only table growth (row counts per partition), open-position/order counts (read-only `count()` via DAL for ops dashboards in D9 later).
- **No metrics are stored in new tables.** Metrics are computed from PostgreSQL (`count`/`list` via the existing DAL) and Redis, exposed as transient value objects. A short-TTL Redis cache may front expensive counts (non-critical).
- Metrics are **observational only** — they never feed back into risk, selection, execution, or sizing.

---

## 8. Failure Detection Rules

| # | Condition | Detection | Severity | Operational response |
|---|-----------|-----------|----------|----------------------|
| 1 | PostgreSQL unreachable at startup | `ConnectionPool` health check (B7) | `Emergency` | Startup aborts (`PersistenceError`); not ready |
| 2 | PostgreSQL lost mid-operation | psycopg2 error propagates | `Emergency` | Exception surfaces to caller; record `PostgresEvent`; alert; affected unit may be dead-lettered |
| 3 | Redis unreachable | `RedisClient.ping()` false / degraded | `Warning` | DEGRADED state; emit `RedisEvent` on transition; continue on PostgreSQL |
| 4 | Worker `run_once()` exception | Scheduler catch | `Critical` | Record `WorkerFailure`; alert; dead-letter the unit (§5); continue scheduler |
| 5 | DLQ depth ≥ threshold | DLQMonitor count | `Warning`→`Critical` | Alert; surface in metrics |
| 6 | Upcoming partition missing | PartitionProvisioner / detector | `Critical` | Provision per convention (A2) or alert |
| 7 | Kill-switch level recorded as L4 | New `KillSwitchActivated` row observed | `Emergency` | Record + alert; reflect in operational state (§10). **B8 does not set the level** |
| 8 | Schema/table missing at startup | Health check query failure | `Emergency` | Not ready; abort; alert |
| 9 | Serialization/infra error | `PersistenceError` from B7 | `Critical` | No partial write; alert; possible dead-letter |
| 10 | Alert dispatch transport failure | Dispatcher exception | `Warning` | Log; durable `system_events` already written; no retry |

All detections **record durably first** (`system_events`), then alert. None of them mutate risk/execution/portfolio state.

---

## 9. Recovery Escalation Model

B8 escalation is **operational**, layered on top of — and strictly separate from — the risk-owned kill-switch ladder.

**Operational severity ladder (B8-owned):**

```
Warning   → log + low-priority alert; system continues (often DEGRADED)
Critical  → high-priority alert + durable system_events; operator action expected
Emergency → all-channel alert + durable system_events; system not-ready or shutdown path
```

**Kill-switch ladder (D4/owner-owned — B8 observes and serves only):**

```
L1 Pause Scanner       \
L2 Pause New Trades     |  decision + level changes owned by D4 / owner;
L3 Pause Execution      |  B8 records (system_events: KillSwitchActivated),
L4 Emergency Shutdown  /   caches the current level in Redis, and rebuilds it
                           from the latest KillSwitchActivated row on restart.
```

- B8 **never** raises or lowers a kill-switch level and **never** blocks trades. It detects conditions, records them durably, alerts, and reflects the *recorded* level in the operational state model. Any automated linkage from an operational `Emergency` to a kill-switch change is a **risk/owner decision (D4/B9)**, not a B8 behavior — preserving **Portfolio ⟂ Risk ⟂ Execution**.
- **Restart recovery (B8 portion):** on startup, read the latest `KillSwitchActivated` row from `system_events` to recover the current level, repopulate the Redis cache, and emit `ServiceStarted`. Rebuilding transient domain aggregates (`PortfolioState`, `DuplicateOrderProtection`, `RiskState`) remains **B9** scope; B8 provides the durable signals and caches that make it possible.
- **No automatic retry** anywhere; recovery of dead-lettered work is manual (§5).

---

## 10. Operational State Model

A transient, computed operational status (not a persisted entity, not a new table) derived from health (§3) + the recorded kill-switch level (§9):

| Operational state | Derivation | Trading implication (observed, not enforced by B8) |
|-------------------|-----------|-----------------------------------------------------|
| **RUNNING** | PostgreSQL up · Redis up · kill-switch NONE/L1 | Normal; D4 governs any L1 scanner pause |
| **DEGRADED** | PostgreSQL up · Redis down (or elevated DLQ) | System functions on PostgreSQL; Redis-backed fast paths fall back |
| **PAUSED** | Kill-switch L2/L3 recorded | New trades / execution paused **by D4**; B8 reflects the recorded level |
| **SHUTDOWN** | Kill-switch L4 recorded, or PostgreSQL unreachable | Emergency; `ServiceStopped`/not-ready; durable record + all-channel alert |

- The state is **observational**: B8 computes and reports it; the actual pausing/blocking of trades is owned by D4 (risk) and D5 (execution). B8 changes no domain state.
- Transitions emit a single `system_events` row (existing members) and an alert at the mapped severity.

---

## 11. Logging & Audit Operations

- **`system_events` (append-only, existing):** B8 is the primary writer of operational events — `ServiceStarted`, `ServiceStopped`, `WorkerFailure`, `RedisEvent`, `PostgresEvent`, `GatewayEvent`, `KillSwitchActivated` (all existing members). Writes go through `dal.system_events.add(...)`; `update`/`delete` raise `ImmutableViolation` (B7 enforcement). Monthly partition routing is automatic.
- **`audit_logs` (append-only, existing):** owned by D5 `AuditEventFlow` for decision/user events (`Login`, `SettingRiskChange`, `Order`, `Shutdown`, `Error`). B8 does **not** write trading-decision audit rows; it may record operator-initiated operational actions only where they map to existing `AuditEventType` members (e.g., `Shutdown`), without modifying D5.
- **Structured application logging (`src/logging/`):** severity-tagged, correlation-id aware, secret-redacted. This is process logging; the durable, queryable record of operationally significant events is always the `system_events` table.
- **Retention:** Hot→Warm→Cold tiering per D1 §7; audit & system data are archived, **never deleted** (RetentionTierer, §6).
- **No secrets** in logs, code, or version control; DSNs/tokens redacted at the logging boundary.

---

## 12. Dependencies

**B8 depends on:**

- **D1** — `SystemEventType`, `SeverityLevel`, `AuditEventType` enum values; `SystemEvent`/`AuditLog` models for event construction.
- **D2** — `DataAccessLayer` interface (`system_events`, `audit_logs` repos; `count`/`list`); `ImmutableViolation` semantics.
- **B7** — `PostgresDataAccessLayer` (durable writes), `ConnectionPool` (health check), `RedisClient` (cache + degraded mode), `PersistenceError`.

**B8 provides to:**

- **B9 Integration** — durable operational signals + caches for startup rebuild; scheduler wiring point.
- **D9 UI** (owner-gated) — read-only health, metrics, DLQ listings.
- **Operators** — alerts, runbooks, DLQ resolution workflow.

**B8 does not depend on D3, D4, D5, D6, or D7.** It reads enum values and the DAL only. **No circular dependencies.** Kill-switch *level* is consumed as recorded data (latest `system_events` row), not via a D4 code dependency.

---

## 13. Out Of Scope

- Any new SQL table, column, index, constraint, or enum member; any modification to the frozen D1 schema or the two SQL files.
- Any modification to D1–D6 or B7 source.
- Risk decisions or kill-switch **level** changes (D4 / owner).
- Order/position state machines, routing, execution (D5).
- Portfolio analytics, PnL, snapshots (D6).
- Selection/scoring (D3).
- Broker / market data / gateways (D7, owner-gated).
- API / FastAPI / WebSocket / UI / dashboards (D9, owner-gated).
- Position sizing (V2-001).
- Automatic retry of failed/dead-lettered work.
- Async/await; ORM frameworks; new repository ABCs.
- Startup rebuild of transient domain aggregates (B9 scope).
- Concrete external alert transports beyond a contract + a default log sink (richer channels are operational config, owner-gated).

---

## 14. Definition Of Done

1. `src/operations/` package: health, alerting, DLQ helper, scheduler, workers, metrics — infrastructure only, no domain logic.
2. **Health monitoring** reports PostgreSQL (mandatory) and Redis (optional/degraded) status via the B7 primitives; PostgreSQL down ⇒ not ready, Redis down ⇒ DEGRADED.
3. **Alerting** maps conditions to the existing `SeverityLevel` vocabulary; writes a durable `system_events` row before best-effort dispatch; `AlertDispatcher` contract with a default log sink; dispatch failures are non-fatal, no retry.
4. **DLQ** captures dead-lettered work as append-only `WorkerFailure` `system_events` rows with a full JSONB envelope; supports operator listing and append-based manual resolution; **no new table/enum**; no automatic retry; optional Redis index rebuildable from PostgreSQL.
5. **Scheduler/workers** run synchronously over the injected `PostgresDataAccessLayer` + `RedisClient`; a failing `run_once()` is recorded and isolated; the scheduler survives individual job failures.
6. **Operational jobs** present per §6 (HealthPoller, DLQMonitor, PartitionProvisioner *or* missing-partition detector per A2, RetentionTierer, HeartbeatEmitter).
7. **Kill-switch level** is served from a Redis cache, written through to `system_events`, and rebuilt from the latest `KillSwitchActivated` row on restart — **without B8 ever changing the level**.
8. **Operational state model** (RUNNING/DEGRADED/PAUSED/SHUTDOWN) computed and reported; observational only.
9. **Metrics & structured logging** operational; `src/logging/` and `src/config/` placeholders filled; secrets redacted.
10. **Failure detection rules** (§8) implemented; each records durably first, then alerts; none mutates risk/execution/portfolio state.
11. **No new entities, tables, enums, or schema changes**; D1–D6 and B7 source **unmodified**.
12. **All existing 194 tests remain green**; B7's **16 always-run tests remain green**; B8 integration tests cover health (PostgreSQL up/down, Redis up/down), alert severity mapping + durable record, DLQ capture/list/resolve, scheduler failure isolation, kill-switch cache write-through + restart rebuild.
13. **No secrets** in code or version control.
14. **Invariants preserved:** PostgreSQL source of truth · Redis non-critical · Portfolio ⟂ Risk ⟂ Execution · no broker · no API/UI · no strategy logic · no sizing logic.
15. Backup/DR/runbook documentation produced; `B8_BUILD_REPORT.md` produced; stop at the B8 gate.
16. Owner ratifications **A1** (DLQ-as-`system_events`) and **A2** (partition provisioning vs. detect-only) resolved at this architecture gate before implementation.

---

## 15. Stop Gate

**STOP.**

This document is **architecture only** — no code, no tests, no source changes, no schema changes, no modifications to B1–B7. Implementation is forbidden until owner approval.

Two decisions require an explicit owner ruling before B8 implementation begins:

- **A1 — DLQ persistence model:** approve DLQ as append-only `WorkerFailure` `system_events` rows (no new table/enum), **or** defer DLQ pending a V2 schema decision.
- **A2 — Monthly partition provisioning:** approve B8 provisioning partitions per the frozen `<table>_pYYYYMM` convention (D1 §7), **or** restrict B8 to *detect-and-alert* on missing partitions and leave provisioning to an external ops/DBA process.

Await owner approval. Do not start B9.
