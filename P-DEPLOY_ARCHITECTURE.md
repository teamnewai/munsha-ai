# P-DEPLOY_ARCHITECTURE

**Type:** Deployment architecture review. **Architecture only — no code, no implementation, no source/schema changes.**
**Derived from (source-verified):** `db/apply_schema.py` · `src/persistence/connection.py` (`ConnectionPool`) · `src/redis/__init__.py` (`RedisClient`) · `src/app/bootstrap.py` (`bootstrap`/`Application.start`/`shutdown`) · `src/app/sizing.py` · `src/app/targets/selection.py` · `src/operations/*` (B8) · `P-ORCH`/`P-DATA`/`P-SIZE` builds.
**Status:** Architecture only — implementation forbidden until owner approval.
**Phase:** P-DEPLOY — deployment-ready **paper-trading** environment for the first autonomous validation run.

**Invariants preserved:** PostgreSQL **sole source of truth** · Redis **non-authoritative** · Portfolio ⟂ Risk ⟂ Execution · **no strategy / risk / execution / schema changes** · **no broker connectivity · no live trading · no TradingView · no IBKR**. P-DEPLOY provisions and operates the already-built stack; it changes no code.

---

## 1. Infrastructure Requirements
| Component | Requirement |
|-----------|-------------|
| **Host** | One Linux node (single-process, synchronous stack — no HA in v1). Python 3.11+ (matches the test runtime). |
| **PostgreSQL** | One reachable instance (the **sole source of truth**). Version supporting `PARTITION BY RANGE`, `JSONB`, `uuid`, `timestamptz` (PostgreSQL 12+). |
| **Redis** | Optional instance (non-authoritative cache). The app runs **DEGRADED** without it. |
| **Python deps** | `psycopg2`(-binary) + `redis` (already used by B7); no broker/vendor/ML libraries. |
| **Network** | **No outbound market/broker network in paper mode** — the Replay/Fixture provider is deterministic and local. Outbound to PostgreSQL/Redis only. |
| **Fixtures** | A deterministic market-data fixture source for the Replay provider (local file/dataset). No live vendor. |
| **Secrets** | A secret store / injected env for `DATABASE_URL` (and `REDIS_URL` if authenticated). No secrets in code/git/images. |

## 2. Environment Variables (exact — every var the code reads)
**Required:**
| Var | Owner | Purpose |
|-----|-------|---------|
| `DATABASE_URL` | B7 `ConnectionPool` | PostgreSQL DSN (required; startup aborts if unreachable) |
| `STARTING_CAPITAL` | B9 bootstrap / P-SIZE | owner base capital (Decimal; non-compounding) |
| `POSITION_ALLOCATION_FRACTION` | P-SIZE | owner per-trade allocation fraction (0 < f ≤ 1) |
| `EXECUTION_TARGET` | D11 selection | **must be `paper`** for this phase (default `signals`) |

**Optional (have safe defaults):**
| Var | Default | Purpose |
|-----|---------|---------|
| `DB_POOL_MIN` / `DB_POOL_MAX` | 1 / 10 | psycopg2 pool sizing |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis DSN (non-authoritative) |
| `REDIS_TIMEOUT_SEC` | 5 | Redis socket timeout |
| `OPS_HEALTH_POLL_INTERVAL_SEC` | 30 | HealthPoller cadence |
| `OPS_DLQ_MONITOR_INTERVAL_SEC` | 60 | DLQMonitor cadence |
| `OPS_DLQ_DEPTH_WARNING` / `OPS_DLQ_DEPTH_CRITICAL` | 1 / 10 | DLQ alert thresholds |
| `OPS_PARTITION_CHECK_INTERVAL_SEC` | 86400 | MissingPartitionDetector cadence |
| `OPS_RETENTION_TIER_INTERVAL_SEC` | 86400 | RetentionTierer cadence |
| `OPS_RETENTION_HOT_MONTHS` / `OPS_RETENTION_WARM_MONTHS` | 3 / 12 | retention tier windows |
| `OPS_KILL_SWITCH_CACHE_KEY` / `OPS_DLQ_INDEX_KEY` | `thul:ops:*` | Redis cache keys |

> **Constraint:** the only "secret" is `DATABASE_URL` (and Redis auth if used). No new env var is introduced by P-DEPLOY — this is the exact set the code already reads. `EXECUTION_TARGET=paper` keeps it Paper-only (Signals/IBKR not selected; `ibkr`/`tradingview` would `NotImplementedError`).

## 3. Deployment Topology
```
            ┌──────────────────────────────────────────────────────┐
            │ Single trading process (synchronous)                  │
            │  bootstrap() → Application (B9)                        │
            │   ├─ ConnectionPool (psycopg2)  ── DATABASE_URL ───────┼──► PostgreSQL (source of truth)
            │   ├─ RedisClient (non-authoritative) ── REDIS_URL ─────┼──► Redis (optional cache)
            │   ├─ B8 operations (Health/Alert/DLQ/KillSwitch/Metrics)
            │   ├─ Domain engines D3/D4/D6 + Paper target (D11→D5)   │
            │   ├─ P-DATA ReplayProvider ◄── local fixtures          │
            │   └─ Scheduler + TradingCycleWorker (P-ORCH)           │
            │        (started ONLY by explicit application.start())  │
            └──────────────────────────────────────────────────────┘
   No inbound network surface · No broker/TradingView/IBKR · Paper only
```
- **One process, one active execution target (`paper`)** (D11 OD-7).
- **No API/UI, no inbound surface** in paper mode.

## 4. Scheduler Deployment
- The B8 `Scheduler` runs the registered workers on a daemon thread; **started only by `application.start()`** (B9 OD-D6) after recovery completes — never auto-started.
- Registered workers (paper run): `TradingCycleWorker` (P-ORCH), `HealthPoller`, `DLQMonitor`, `MissingPartitionDetector` (detect-only, A2), `RetentionTierer` (read-only).
- **Cadence:** Core EOD / Turbo intraday per the NY session calendar (operator-set intervals); market-closed ticks are no-ops.
- **Process supervision:** run under a supervisor (systemd/container restart policy) so a crash triggers a clean restart → B9 recovery re-runs (idempotent).

## 5. PostgreSQL Requirements
- **Provision the frozen D1 schema** via `python db/apply_schema.py` (applies `001_init_schema.sql` + `partition_retention.sql` in one transaction; **no schema change**).
- **Monthly partitions:** the current (and upcoming) month's partitions for the 6 partitioned tables must exist (`<table>_pYYYYMM`). B8 **detects-and-alerts** on a missing partition (A2); an **external ops step** creates them per the frozen convention (P-DEPLOY does not auto-provision — owner ratification A2).
- **Startup health gate:** `ConnectionPool` runs `SELECT 1` on init and raises `PersistenceError` if unreachable — the process **cannot start** with a broken DB.
- **Seed data:** the tradable universe (`instruments` + `sectors`) and an operator `users` row (for `operator_user_id`) must be seeded before the first run (the orchestrator resolves `symbol → instrument_id` and skips unknown symbols).
- **Connection:** TLS/`sslmode` per deployment policy; least-privilege DB role (CRUD on the 19 tables).

## 6. Redis Requirements
- **Optional, non-authoritative.** Holds only the kill-switch level cache and DLQ index (rebuildable from PostgreSQL). Treated as **cold on restart**.
- If unreachable: app logs WARNING, runs **DEGRADED**, all reads fall back to PostgreSQL. Never a startup blocker.
- No persistence guarantees required of Redis; no Redis backup needed.

## 7. Logging Requirements
- Use the built **structured logging** (`src/logging`): severity-tagged, **secret-redacted** (DSN credentials / `key=secret` patterns stripped at the boundary).
- Ship process logs to the host's log pipeline (journald/file/collector). **No secrets in logs.**
- The durable, queryable operational record is the append-only `system_events` table (not just process logs).

## 8. Monitoring Requirements
- **Health:** consume `HealthMonitor`/operational-state (RUNNING / DEGRADED / PAUSED / SHUTDOWN); PostgreSQL down ⇒ not-ready, Redis down ⇒ DEGRADED.
- **Alerts:** B8 `AlertManager` writes a durable `system_events` row first, then best-effort dispatch (default log sink). Watch `WorkerFailure`, `GatewayEvent` (data-quality rejects, kill-switch), `PostgresEvent`.
- **DLQ:** monitor unresolved depth (`DLQMonitor`); investigate `WorkerFailure` envelopes; **manual resolution only** (no auto-retry).
- **Metrics:** `MetricsCollector` (read-only): PG/Redis health, DLQ depth, open positions/orders. Surface to the host's metrics pipeline.
- **Partitions:** alert on `MissingPartitionDetector` `Critical` and provision before the month rolls.

## 9. Backup Requirements
- **PostgreSQL is the only thing to back up** (sole source of truth): scheduled `pg_dump` + WAL/PITR per the owner's RPO/RTO. Audit/system data is append-only and **never deleted** (Hot→Warm→Cold retention).
- **Redis: no backup** (ephemeral, rebuildable from PostgreSQL).
- **Fixtures/config:** version-controlled; secrets in the secret store (not in backups of code).

## 10. Recovery Requirements
- On (re)start, **B9 recovery runs first** (read-only, from PostgreSQL): kill-switch cache → PortfolioState → DuplicateOrderProtection → RiskState inputs → warm Redis (ratified order). Marks are cold; re-acquired from the Replay provider.
- **No duplicate actions:** in-flight (`New`/`Sent`) order fingerprints are re-registered; the orchestrator holds **no durable cycle state** and starts fresh cycles against the recovered state. Crash-restart ≡ graceful restart.
- A `Recovery` audit event records what was restored.

## 11. Paper-Trading Startup Procedure
1. **Provision infra:** PostgreSQL (+ optional Redis) reachable.
2. **Apply schema:** `python db/apply_schema.py` (idempotent on a fresh DB).
3. **Provision partitions:** ensure current/upcoming month partitions exist (external ops step).
4. **Seed data:** `instruments`/`sectors` universe + operator `users` row.
5. **Set env:** `DATABASE_URL`, `STARTING_CAPITAL`, `POSITION_ALLOCATION_FRACTION`, **`EXECUTION_TARGET=paper`** (+ optional vars / Redis).
6. **Compose + recover:** `bootstrap()` builds the `Application` (health-gated; aborts if PG unreachable) and runs B9 recovery → emits `ServiceStarted`.
7. **Wire the orchestrator:** construct the Paper `ExecutionTarget`, `SizingPolicy`, `CapitalSettings` (from env), the P-DATA Replay provider, and the `TradingCycleWorker`; register it with the scheduler. *(Integration wiring per P-ORCH; no code change here.)*
8. **Operator verifies recovered state** (portfolio/open positions/kill-switch level via metrics).
9. **Explicit start:** `application.start()` — the autonomous paper loop begins (B9 OD-D6).

## 12. Paper-Trading Shutdown Procedure
1. `application.shutdown()` — stops the scheduler (finishes current tick), settles in-flight DAL work (B7 transactions), emits `ServiceStopped`, closes the pool.
2. Confirm no orphaned in-flight work (DLQ empty of execution failures).
3. Process stop via the supervisor. **No data loss** — all durable state is in PostgreSQL; Redis discarded.
4. Idempotent: safe to call once; restart re-runs recovery.

## 13. Validation Checklist (pre–first-run)
- [ ] PostgreSQL reachable; `DATABASE_URL` set; `SELECT 1` passes (bootstrap health gate).
- [ ] `python db/apply_schema.py` applied (19 tables present).
- [ ] Current + upcoming month partitions exist for all 6 partitioned tables.
- [ ] `instruments`/`sectors` universe + operator `users` row seeded.
- [ ] `STARTING_CAPITAL`, `POSITION_ALLOCATION_FRACTION` set (finite, valid); **`EXECUTION_TARGET=paper`**.
- [ ] Redis optional: if set, reachable; if not, DEGRADED accepted.
- [ ] Logging configured; **secret redaction verified** (no DSN creds in logs).
- [ ] Monitoring wired: health state, alerts, DLQ depth, partition alerts, metrics.
- [ ] PostgreSQL backup (pg_dump/PITR) scheduled.
- [ ] Full test suite green in the deploy image (**372 passed / 24 skipped**; the 24 DB-integration tests run green against the provisioned PostgreSQL).
- [ ] `bootstrap()` composes + recovery completes; `ServiceStarted` recorded; operator verifies recovered state.
- [ ] Paper target confirmed (`broker_ref` prefix `paper:`); **no broker/TradingView/IBKR wired**.
- [ ] `application.start()` begins the loop; first cycle audited (scan/cycle_summary events; signals/scores/risk_checks rows).
- [ ] Kill-switch path verified (operator can record a level; loop honors it).
- [ ] Data-quality reject path verified (a bad fixture frame → Reject Cycle + DLQ, no trade).

---

## 14. Out of Scope (P-DEPLOY)
- Live broker connectivity, IBKR, TradingView, market-data vendor (Replay/Fixture only).
- Any code/source/schema change; any strategy/risk/execution/allocation change.
- Multi-process/HA, API/UI, auto partition provisioning (detect-and-alert only, A2).
- D14 validation reporting build (separate phase; measures the run).

## 15. Stop Gate
**STOP.**

Deployment architecture only — no code, no implementation, no source/schema changes. Await owner approval before any deployment/provisioning is executed. Do not begin TradingView, IBKR, or Live Trading.
